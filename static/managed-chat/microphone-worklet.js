class Capture extends AudioWorkletProcessor {
	constructor({ processorOptions }) {
		super();
		this.remaining = processorOptions.maxFrames;
		this.finished = false;
	}
	process(inputs, outputs) {
		for (const channel of outputs[0] ?? []) channel.fill(0); // Never monitor the microphone through speakers.
		if (this.finished) return false;
		const channels = inputs[0];
		if (!channels?.length) return true;
		const count = Math.min(channels[0].length, this.remaining),
			samples = new Float32Array(count);
		for (const channel of channels)
			for (let i = 0; i < count; i++) samples[i] += channel[i] / channels.length;
		this.remaining -= count;
		if (count) this.port.postMessage({ samples }, [samples.buffer]);
		if (this.remaining === 0) {
			this.finished = true;
			this.port.postMessage({ limit: true });
			return false;
		}
		return true;
	}
}
registerProcessor("chabo-pcm", Capture);
