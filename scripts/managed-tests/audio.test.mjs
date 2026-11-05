/* eslint-env es2021 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { pcmWav, inspectWav, Microphone } from "../../static/managed-chat/audio.js";
test("PCM16 WAV encodes exact signed bounds and validates format/duration without trusting file names", () => {
	const samples = new Float32Array(1600);
	samples.set([-1, 0, 1, 2, -2]);
	const bytes = pcmWav(samples),
		v = new DataView(bytes.buffer);
	assert.deepEqual(inspectWav(bytes), { seconds: 0.1, rate: 16000, frames: 1600 });
	assert.equal(v.getInt16(44, true), -32768);
	assert.equal(v.getInt16(48, true), 32767);
	assert.equal(v.getInt16(50, true), 32767);
	assert.equal(v.getInt16(52, true), -32768);
	const stereo = bytes.slice();
	new DataView(stereo.buffer).setUint16(22, 2, true);
	assert.throws(() => inspectWav(stereo), /unsupported_wav/);
	const compressed = bytes.slice();
	new DataView(compressed.buffer).setUint16(20, 3, true);
	assert.throws(() => inspectWav(compressed), /unsupported_wav/);
	assert.throws(() => inspectWav(bytes.subarray(0, bytes.length - 1)), /invalid_wav/);
	assert.throws(
		() => inspectWav(pcmWav(new Float32Array(16000 * 16)), { maxSeconds: 15 }),
		/invalid_audio_duration/
	);
	samples[0] = NaN;
	assert.throws(() => pcmWav(samples), /invalid_samples/);
});
test("AudioWorklet handles variable blocks/stereo, silences monitoring and stops at exact maximum frames", async () => {
	let Capture;
	const sent = [];
	vm.runInNewContext(
		await readFile(
			new URL("../../static/managed-chat/microphone-worklet.js", import.meta.url),
			"utf8"
		),
		{
			AudioWorkletProcessor: class {
				constructor() {
					this.port = { postMessage: (message) => sent.push(message) };
				}
			},
			registerProcessor: (name, type) => {
				assert.equal(name, "chabo-pcm");
				Capture = type;
			},
		}
	);
	const node = new Capture({ processorOptions: { maxFrames: 150 } }),
		out = [new Float32Array(100).fill(1)];
	assert.equal(
		node.process([[new Float32Array(64).fill(1), new Float32Array(64).fill(-1)]], [out]),
		true
	);
	assert.equal(node.process([[new Float32Array(100).fill(0.5)]], [out]), false);
	assert.equal(
		sent.filter((v) => v.samples).reduce((n, v) => n + v.samples.length, 0),
		150
	);
	assert.ok(Array.from(sent[0].samples).every((v) => v === 0));
	assert.equal(sent.at(-1).limit, true);
	assert.ok(out[0].every((v) => v === 0));
	assert.equal(node.process([[new Float32Array(128)]], [out]), false);
	assert.equal(sent.length, 3);
});
test("cancel while microphone permission is pending stops tracks when permission resolves", async () => {
	const descriptors = {
		navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
		secure: Object.getOwnPropertyDescriptor(globalThis, "isSecureContext"),
	};
	let resolve,
		stops = 0;
	Object.defineProperty(globalThis, "isSecureContext", { value: true, configurable: true });
	Object.defineProperty(globalThis, "navigator", {
		value: {
			mediaDevices: {
				getUserMedia: () =>
					new Promise((r) => {
						resolve = r;
					}),
			},
		},
		configurable: true,
	});
	try {
		const mic = new Microphone(),
			start = mic.start(15, () => {});
		await mic.cancel();
		resolve({ getTracks: () => [{ stop: () => stops++ }] });
		await assert.rejects(() => start, /recording_cancelled/);
		assert.equal(stops, 1);
		assert.equal(mic.context, null);
		assert.equal(mic.stream, null);
	} finally {
		for (const [name, descriptor] of [
			["navigator", descriptors.navigator],
			["isSecureContext", descriptors.secure],
		]) {
			if (descriptor) Object.defineProperty(globalThis, name, descriptor);
			else delete globalThis[name];
		}
	}
});
