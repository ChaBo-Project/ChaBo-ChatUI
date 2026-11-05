import { test } from "node:test";
import assert from "node:assert/strict";
import { ChatClient, ApiError, boundedBody } from "../../static/managed-chat/client.js";
const conversation = "a".repeat(32),
	turn = "b".repeat(32),
	hash = async (bytes) => Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
const json = (value) =>
	new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
test("explicit retry preserves turn/body; requests use same-origin cookie/CSRF with no credentials in headers", async () => {
	const requests = [],
		client = new ChatClient(async (url, options) => {
			requests.push({ url, options });
			throw Error("Interrupted");
		});
	client.csrf = "session-csrf";
	for (let i = 0; i < 2; i++)
		await assert.rejects(
			() => client.text("demo", conversation, turn, "Question"),
			(e) => e instanceof ApiError && e.status === 0 && e.uncertain
		);
	assert.equal(requests.length, 2);
	assert.equal(requests[0].url, requests[1].url);
	assert.equal(requests[0].options.body, requests[1].options.body);
	assert.equal(requests[0].options.credentials, "same-origin");
	assert.equal(requests[0].options.redirect, "error");
	assert.equal(requests[0].options.headers["X-CSRF-Token"], "session-csrf");
	assert.ok(!("Authorization" in requests[0].options.headers));
	await assert.rejects(() => client.text("../other", conversation, turn, "Q"));
	assert.equal(requests.length, 2);
});
test("recognition verifies input SHA and manual audio retry retains exact binary bytes", async () => {
	const bytes = new Uint8Array([255, 254, 0, 1]),
		seen = [];
	const value = {
		conversation_id: conversation,
		turn_id: turn,
		answer: "Answer",
		sources: [],
		transcription: { text: "Question", language: "en", audio_sha256: await hash(bytes) },
	};
	const client = new ChatClient(async (_url, options) => {
		seen.push(options.body);
		return json(value);
	});
	await client.audio("demo", conversation, turn, bytes);
	await client.audio("demo", conversation, turn, bytes);
	assert.deepEqual(seen, [bytes, bytes]);
	value.transcription.audio_sha256 = "0".repeat(64);
	await assert.rejects(
		() => client.audio("demo", conversation, turn, bytes),
		(e) => e.uncertain === true
	);
});
test("known rejection is not retried; mismatched answer owner resource is never accepted", async () => {
	let calls = 0;
	const denied = new ChatClient(async () => {
		calls++;
		return new Response('{"error":{"code":"conflict"}}', { status: 409 });
	});
	await assert.rejects(
		() => denied.text("demo", conversation, turn, "Q"),
		(e) => e.status === 409 && !e.uncertain
	);
	assert.equal(calls, 1);
	const wrong = new ChatClient(async () =>
		json({ conversation_id: "c".repeat(32), turn_id: turn, answer: "Other answer", sources: [] })
	);
	await assert.rejects(
		() => wrong.text("demo", conversation, turn, "Q"),
		(e) => e.uncertain === true
	);
});
test("bounded responses cancel oversize streams", async () => {
	let cancelled = false;
	const response = new Response(
		new ReadableStream({
			start(c) {
				c.enqueue(new Uint8Array(25));
			},
			cancel() {
				cancelled = true;
			},
		})
	);
	await assert.rejects(() => boundedBody(response, 20), /response_too_large/);
	assert.equal(cancelled, true);
});
test("playback requires digest, language and exact segment position, including position zero", async () => {
	const bytes = new Uint8Array(20),
		headers = {
			"Content-Type": "audio/wav",
			"X-Audio-Sample-Rate": "24000",
			"X-Speech-Segment": "0",
			"X-Speech-Segment-Count": "1",
			"X-Speech-Language": "en",
			"X-Content-SHA256": await hash(bytes),
		};
	const client = new ChatClient(async () => new Response(bytes, { headers }));
	assert.equal((await client.speech("demo", conversation, turn, 0, "en-alba")).language, "en");
	delete headers["X-Speech-Segment"];
	await assert.rejects(
		() => client.speech("demo", conversation, turn, 0, "en-alba"),
		/invalid_audio_response/
	);
	headers["X-Speech-Segment"] = "0";
	headers["X-Content-SHA256"] = "0".repeat(64);
	await assert.rejects(
		() => client.speech("demo", conversation, turn, 0, "en-alba"),
		/invalid_audio_digest/
	);
});
