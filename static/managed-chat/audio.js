/* eslint-env es2021 */
/** Audio stays in memory. Capture at the device's actual rate; resample in Web Audio. */
export function inspectWav(bytes, { rate = 16000, maxSeconds = 30, maxBytes = 1048576 } = {}) {
	if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44 || bytes.byteLength > maxBytes)
		throw new Error("invalid_audio_size");
	const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
		text = (start, end) => new TextDecoder().decode(bytes.subarray(start, end));
	if (text(0, 4) !== "RIFF" || text(8, 12) !== "WAVE" || v.getUint32(4, true) !== bytes.length - 8)
		throw new Error("invalid_wav");
	let offset = 12,
		format = false,
		dataBytes = 0,
		found = false,
		chunks = 0;
	while (offset + 8 <= bytes.length) {
		if (++chunks > 64) throw new Error("invalid_wav");
		const name = text(offset, offset + 4),
			size = v.getUint32(offset + 4, true),
			start = offset + 8,
			end = start + size;
		if (end > bytes.length) throw new Error("invalid_wav");
		if (name === "fmt ") {
			if (
				format ||
				![16, 18].includes(size) ||
				v.getUint16(start, true) !== 1 ||
				v.getUint16(start + 2, true) !== 1 ||
				v.getUint32(start + 4, true) !== rate ||
				v.getUint32(start + 8, true) !== rate * 2 ||
				v.getUint16(start + 12, true) !== 2 ||
				v.getUint16(start + 14, true) !== 16 ||
				(size === 18 && v.getUint16(start + 16, true) !== 0)
			)
				throw new Error("unsupported_wav");
			format = true;
		} else if (name === "data") {
			if (!format || found || size % 2) throw new Error("invalid_wav");
			found = true;
			dataBytes = size;
		} else if (size > 65536) throw new Error("invalid_wav");
		offset = end + (size % 2);
	}
	const seconds = dataBytes / (rate * 2);
	if (offset !== bytes.length || !found || seconds < 0.1 || seconds > maxSeconds)
		throw new Error("invalid_audio_duration");
	return { seconds, rate, frames: dataBytes / 2 };
}
export function pcmWav(samples, rate = 16000) {
	if (
		!(samples instanceof Float32Array) ||
		!Number.isInteger(rate) ||
		rate < 8000 ||
		rate > 96000 ||
		samples.length < rate / 10 ||
		samples.length > rate * 30
	)
		throw new Error("invalid_samples");
	const bytes = new Uint8Array(44 + samples.length * 2),
		v = new DataView(bytes.buffer);
	const text = (at, s) => {
		for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
	};
	text(0, "RIFF");
	v.setUint32(4, bytes.length - 8, true);
	text(8, "WAVEfmt ");
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, rate, true);
	v.setUint32(28, rate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	text(36, "data");
	v.setUint32(40, samples.length * 2, true);
	for (let i = 0; i < samples.length; i++) {
		if (!Number.isFinite(samples[i])) throw new Error("invalid_samples");
		const value = Math.max(-1, Math.min(1, samples[i]));
		v.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
	}
	return bytes;
}
export async function resamplePcm(
	samples,
	rate,
	maxSeconds,
	Offline = globalThis.OfflineAudioContext
) {
	if (
		![15, 30].includes(maxSeconds) ||
		samples.length / rate > maxSeconds ||
		samples.length / rate < 0.1
	)
		throw new Error("invalid_audio_duration");
	if (rate === 16000) return pcmWav(samples);
	const length = Math.min(16000 * maxSeconds, Math.floor((samples.length * 16000) / rate));
	const context = new Offline(1, length, 16000),
		buffer = context.createBuffer(1, samples.length, rate);
	buffer.copyToChannel(samples, 0);
	const source = context.createBufferSource();
	source.buffer = buffer;
	source.connect(context.destination);
	source.start();
	const rendered = await context.startRendering();
	return pcmWav(rendered.getChannelData(0));
}
export class Microphone {
	constructor() {
		this.stream = null;
		this.context = null;
		this.node = null;
		this.parts = [];
		this.frames = 0;
		this.finishing = null;
		this.accept = false;
		this.generation = 0;
	}
	async start(maxSeconds, onLimit) {
		if (
			this.context ||
			this.stream ||
			!globalThis.isSecureContext ||
			!navigator.mediaDevices?.getUserMedia
		)
			throw new Error("microphone_unavailable");
		if (![15, 30].includes(maxSeconds)) throw new Error("invalid_duration");
		this.maxSeconds = maxSeconds;
		this.parts = [];
		this.frames = 0;
		this.finishing = null;
		const generation = ++this.generation;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
			if (generation !== this.generation) {
				stream.getTracks().forEach((track) => track.stop());
				throw new Error("recording_cancelled");
			}
			this.stream = stream;
			this.context = new AudioContext();
			await this.context.audioWorklet.addModule(
				new URL("./microphone-worklet.js", import.meta.url),
				{ credentials: "same-origin" }
			);
			if (generation !== this.generation) throw new Error("recording_cancelled");
			this.node = new AudioWorkletNode(this.context, "chabo-pcm", {
				numberOfInputs: 1,
				numberOfOutputs: 1,
				outputChannelCount: [1],
				processorOptions: { maxFrames: Math.floor(this.context.sampleRate * maxSeconds) },
			});
			this.accept = true;
			this.node.port.onmessage = ({ data }) => {
				if (!this.accept) return;
				if (data.samples) {
					this.frames += data.samples.length;
					if (this.frames > this.context.sampleRate * maxSeconds) {
						this.cancel();
						return;
					}
					this.parts.push(data.samples);
				}
				if (data.limit) onLimit();
			};
			this.source = this.context.createMediaStreamSource(this.stream);
			this.source.connect(this.node);
			this.node.connect(this.context.destination);
			await this.context.resume();
		} catch (error) {
			await this.cancel();
			throw error;
		}
	}
	async stop() {
		if (this.finishing) return this.finishing;
		if (!this.context) throw new Error("not_recording");
		this.finishing = (async () => {
			const rate = this.context.sampleRate;
			this.accept = false;
			const parts = this.parts,
				frames = this.frames;
			await this.release();
			this.parts = [];
			const samples = new Float32Array(frames);
			let offset = 0;
			for (const part of parts) {
				samples.set(part, offset);
				offset += part.length;
			}
			return resamplePcm(samples, rate, this.maxSeconds);
		})();
		return this.finishing;
	}
	async release() {
		this.generation++;
		this.accept = false;
		this.stream?.getTracks().forEach((track) => track.stop());
		this.stream = null;
		this.node?.disconnect();
		this.node?.port.close();
		this.node = null;
		this.source?.disconnect();
		this.source = null;
		const context = this.context;
		this.context = null;
		if (context && context.state !== "closed") await context.close();
	}
	async cancel() {
		await this.release();
		this.parts = [];
		this.frames = 0;
	}
}
