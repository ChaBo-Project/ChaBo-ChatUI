/* eslint-env es2021 */
/** Same-origin human-session adapter. No provider, service or documentation keys. */
export class ApiError extends Error {
	constructor(status, code = "unavailable", uncertain = false) {
		super(code);
		this.status = status;
		this.code = code;
		this.uncertain = uncertain;
	}
}
const id = /^[a-f0-9]{32}$/,
	botId = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export function turnId() {
	return crypto.randomUUID().replaceAll("-", "");
}
async function sha256(bytes) {
	return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (n) =>
		n.toString(16).padStart(2, "0")
	).join("");
}
function answer(value, conversation, turn) {
	if (
		!value ||
		value.conversation_id !== conversation ||
		value.turn_id !== turn ||
		typeof value.answer !== "string" ||
		!value.answer.trim() ||
		!Array.isArray(value.sources)
	)
		throw new ApiError(0, "invalid_answer", true);
	return value;
}
function identifier(value, pattern = id) {
	if (typeof value !== "string" || !pattern.test(value)) throw new Error("invalid_identifier");
	return value;
}
export async function boundedBody(response, limit) {
	if (Number(response.headers.get("content-length")) > limit) {
		await response.body?.cancel();
		throw new Error("response_too_large");
	}
	const reader = response.body?.getReader();
	if (!reader) throw new Error("empty_response");
	const chunks = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) throw new Error("response_too_large");
			chunks.push(value);
		}
	} finally {
		await reader.cancel();
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
export class ChatClient {
	constructor(fetcher = globalThis.fetch.bind(globalThis)) {
		this.fetcher = fetcher;
		this.csrf = "";
	}
	async request(
		path,
		{
			method = "GET",
			body,
			type = "application/json",
			binary = false,
			signal,
			timeout = 80000,
		} = {}
	) {
		if (!path.startsWith("/v1/") || path.includes("?") || path.includes("#"))
			throw new Error("invalid_path");
		const write = method !== "GET",
			headers = { Accept: binary ? "audio/wav" : "application/json" };
		if (write) {
			headers["Content-Type"] = type;
			if (this.csrf) headers["X-CSRF-Token"] = this.csrf;
		}
		const timer = AbortSignal.timeout(timeout),
			combined = signal ? AbortSignal.any([timer, signal]) : timer;
		try {
			const response = await this.fetcher("/management" + path, {
				method,
				credentials: "same-origin",
				cache: "no-store",
				redirect: "error",
				headers,
				body:
					body === undefined
						? undefined
						: body instanceof Uint8Array || body instanceof ArrayBuffer
						? body
						: JSON.stringify(body),
				signal: combined,
			});
			if (response.status === 204) return null;
			const bytes = await boundedBody(response, binary && response.ok ? 1440044 : 1100000);
			if (!response.ok) {
				let code = "request_rejected";
				try {
					code = JSON.parse(new TextDecoder().decode(bytes)).error?.code ?? code;
				} catch {
					/* Non-JSON errors retain the generic rejection code. */
				}
				throw new ApiError(response.status, code);
			}
			if (binary) return { bytes, headers: response.headers };
			if (response.headers.get("content-type")?.split(";")[0] !== "application/json")
				throw new Error("invalid_response");
			return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
		} catch (error) {
			if (error instanceof ApiError) throw error;
			throw new ApiError(0, "network_or_invalid_response", write);
		}
	}
	async session() {
		const value = await this.request("/v1/me");
		this.csrf = value.csrf_token;
		return value;
	}
	requestCode(email, password) {
		return this.request("/v1/auth/request-code", {
			method: "POST",
			body: { email, ...(password ? { password } : {}) },
		});
	}
	async verify(challenge_id, code) {
		const value = await this.request("/v1/auth/verify-code", {
			method: "POST",
			body: { challenge_id, code },
		});
		this.csrf = value.csrf_token;
		return value;
	}
	async logout() {
		try {
			await this.request("/v1/auth/logout", { method: "POST" });
		} finally {
			this.csrf = "";
		}
	}
	path(bot, conversation) {
		return "/v1/bots/" + identifier(bot, botId) + "/chat/" + identifier(conversation);
	}
	create(bot, conversation, collection_id, language) {
		if (!["en", "rw"].includes(language)) throw new Error("invalid_language");
		return this.request(this.path(bot, conversation), {
			method: "PUT",
			body: { collection_id: identifier(collection_id), language },
		});
	}
	history(bot, conversation) {
		return this.request(this.path(bot, conversation));
	}
	remove(bot, conversation) {
		return this.request(this.path(bot, conversation), { method: "DELETE" });
	}
	async text(bot, conversation, turn, text) {
		return answer(
			await this.request(this.path(bot, conversation) + "/turns/" + identifier(turn), {
				method: "PUT",
				body: { text },
			}),
			conversation,
			turn
		);
	}
	async audio(bot, conversation, turn, wav) {
		const value = answer(
			await this.request(this.path(bot, conversation) + "/audio-turns/" + identifier(turn), {
				method: "PUT",
				body: wav,
				type: "audio/wav",
				timeout: 110000,
			}),
			conversation,
			turn
		);
		if (
			typeof value.transcription?.text !== "string" ||
			!["en", "rw"].includes(value.transcription.language) ||
			value.transcription.audio_sha256 !== (await sha256(wav))
		)
			throw new ApiError(0, "invalid_transcription", true);
		return value;
	}
	manifest(bot, conversation, turn) {
		return this.request(this.path(bot, conversation) + "/turns/" + identifier(turn) + "/speech");
	}
	async speech(bot, conversation, turn, segment, voice, signal) {
		const result = await this.request(
			this.path(bot, conversation) + "/turns/" + identifier(turn) + "/speech",
			{ method: "POST", body: { segment, ...(voice ? { voice } : {}) }, binary: true, signal }
		);
		const h = result.headers;
		if (
			h.get("content-type")?.split(";")[0] !== "audio/wav" ||
			h.get("x-audio-sample-rate") !== "24000" ||
			h.get("x-speech-segment") !== String(segment) ||
			!["en", "rw"].includes(h.get("x-speech-language")) ||
			!Number.isSafeInteger(Number(h.get("x-speech-segment-count"))) ||
			Number(h.get("x-speech-segment-count")) < 1
		)
			throw new Error("invalid_audio_response");
		const hash = await sha256(result.bytes);
		if (hash !== h.get("x-content-sha256")) throw new Error("invalid_audio_digest");
		return {
			...result,
			language: h.get("x-speech-language"),
			segmentCount: Number(h.get("x-speech-segment-count")),
		};
	}
}
