import { ChatClient, ApiError, turnId } from "./client.js";
import { Microphone, inspectWav } from "./audio.js";
export function mountManaged(root) {
	let disposed = false;
	const $ = (id) => root.querySelector("#" + CSS.escape(id)),
		client = new ChatClient(),
		mic = new Microphone();
	const state = {
		session: null,
		challenge: null,
		conversation: null,
		messages: [],
		busy: false,
		recording: false,
		audio: null,
		pending: null,
		playback: null,
		playing: false,
	};
	const mobile = matchMedia("(max-width:760px)"),
		onMobile = (event) => {
			$("setup").open = !event.matches || !state.conversation;
		};
	mobile.addEventListener("change", onMobile);
	let previewURL = null,
		answerURL = null,
		playRun = 0,
		playAbort = null,
		recordTimer = null;
	function status(text) {
		if (disposed) return;
		$("status").textContent = text;
	}
	function clearError() {
		$("error").hidden = true;
		$("error").textContent = "";
	}
	function failure(error) {
		if (disposed) return;
		const messages = {
			400: "The request was rejected. Check the question or audio format.",
			401: "Your session expired. Sign in again.",
			403: "This account cannot perform that action. Sign in again if your session changed.",
			404: "The resource is unavailable to this account.",
			409: "This turn conflicts with an earlier attempt. Check history before starting another question.",
			413: "The question or audio exceeds the selected language limit.",
			429: "A service is busy. No automatic retry was made; check history before retrying.",
			503: "A service is unavailable. Check history before explicitly retrying.",
			0: "The connection failed or returned an invalid response. The request may have completed; check history.",
		};
		const local = {
			invalid_identifier: "Enter valid bot, collection and conversation IDs.",
			invalid_language: "Choose English or Kinyarwanda.",
			microphone_unavailable:
				"Microphone capture requires HTTPS and a browser with AudioWorklet. You can choose a supported WAV file instead.",
			invalid_audio_size: "Choose a WAV recording no larger than 1 MiB.",
			invalid_wav: "The recording is not a valid WAV file.",
			unsupported_wav: "Choose mono 16 kHz PCM16 WAV audio.",
			invalid_audio_duration:
				"Record at least 0.1 seconds, at most 30 seconds in English or 15 seconds in Kinyarwanda.",
			empty_question: "Enter a question.",
			missing_collection: "Enter a published collection ID for a new conversation.",
			invalid_audio_response:
				"The speech response did not match the conversation. Playback stopped.",
			invalid_audio_digest: "Audio integrity verification failed. Playback stopped.",
		};
		$("error").textContent =
			error instanceof ApiError
				? messages[error.status] ?? "The request was rejected."
				: error.name === "NotAllowedError"
				? "Microphone permission was not granted. You can choose a WAV file instead."
				: local[error.message] ?? "This action could not be completed.";
		$("error").hidden = false;
	}
	function sync() {
		if (disposed) return;
		const connected = !!state.session,
			open = !!state.conversation,
			blocked = state.busy || state.recording || state.playing;
		$("login").hidden = connected;
		$("verify").hidden = connected || !state.challenge;
		$("logout").hidden = !connected;
		$("identity").textContent = connected
			? state.session.user.email + " · " + state.session.user.role
			: "Sign in with your ChaBo account.";
		for (const input of root.querySelectorAll(
			"#login input,#login button,#verify input,#verify button"
		))
			input.disabled = state.busy;
		$("settings").disabled = !connected || blocked || open || !!state.pending;
		$("question-controls").disabled = !open || blocked || !!state.pending || !!state.audio;
		$("refresh").disabled = !open || blocked;
		$("delete").disabled = !open || blocked;
		$("logout").disabled = state.busy;
		$("recording").hidden = !state.recording;
		$("stop-record").disabled = state.busy;
		$("audio-preview").hidden = !state.audio;
		$("send-audio").disabled = !open || blocked || !state.audio;
		$("discard-audio").disabled = blocked;
		$("recovery").hidden = !state.pending;
		$("pending-id").textContent = state.pending ? "Turn ID: " + state.pending.id : "";
		$("retry").disabled = blocked;
		$("discard-pending").disabled = blocked;
		$("playback").hidden = !state.playback;
		for (const id of ["voice", "segment", "play"]) $(id).disabled = blocked;
		$("stop-playback").disabled = !state.playing;
		for (const button of root.querySelectorAll(".message button")) button.disabled = blocked;
		const language = state.conversation?.language ?? $("language").value;
		$("rw-notice").hidden = language !== "rw";
		$("record").textContent = language === "rw" ? "Record voice (evaluation)" : "Record voice";
		$("conversation-label").textContent = open
			? state.conversation.bot + " · " + language + " · " + state.conversation.id
			: "Sign in and open a published collection to begin.";
		$("binding").textContent = open ? "Collection: " + state.conversation.collection_id : "";
	}
	function clearAudio() {
		if (previewURL) URL.revokeObjectURL(previewURL);
		previewURL = null;
		$("input-audio").pause();
		$("input-audio").removeAttribute("src");
		$("input-audio").load();
		$("file").value = "";
		state.audio = null;
	}
	function stopPlayback() {
		playRun++;
		playAbort?.abort();
		playAbort = null;
		state.playing = false;
		$("answer-audio").onended = null;
		$("answer-audio").pause();
		$("answer-audio").removeAttribute("src");
		$("answer-audio").load();
		if (answerURL) URL.revokeObjectURL(answerURL);
		answerURL = null;
		sync();
	}
	async function clearView() {
		stopPlayback();
		await mic.cancel();
		clearInterval(recordTimer);
		state.recording = false;
		clearAudio();
		state.pending = null;
		state.playback = null;
		state.conversation = null;
		state.messages = [];
		$("setup").open = true;
		$("question").value = "";
		$("resume").value = "";
		render();
	}
	async function expireSession() {
		await clearView();
		state.session = null;
		state.challenge = null;
		client.csrf = "";
		$("password").value = "";
		$("code").value = "";
		sync();
	}
	async function run(action) {
		if (disposed || state.busy) return;
		state.busy = true;
		clearError();
		sync();
		try {
			await action();
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) await expireSession();
			failure(error);
		} finally {
			state.busy = false;
			sync();
		}
	}
	function render() {
		if (disposed) return;
		$("messages").replaceChildren();
		if (!state.messages.length) {
			const p = document.createElement("p");
			p.className = "empty";
			p.textContent = "Your questions and answers will appear here.";
			$("messages").append(p);
			return;
		}
		for (const message of state.messages) {
			const article = document.createElement("article");
			article.className = "message " + (message.role === "user" ? "user" : "assistant");
			const label = document.createElement("strong");
			label.textContent = message.role === "user" ? "You" : "ChaBo";
			const body = document.createElement("p");
			body.className = "content";
			body.textContent = message.content;
			article.append(label, body);
			if (message.role === "assistant" && /^[a-f0-9]{32}$/.test(message.turn_id ?? "")) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "secondary";
				button.textContent = "Listen to this answer";
				button.disabled = state.busy || state.playing || state.recording;
				button.onclick = () => run(() => preparePlayback(message.turn_id));
				article.append(button);
			}
			$("messages").append(article);
		}
		$("messages").scrollTop = $("messages").scrollHeight;
	}
	async function loadHistory() {
		const c = state.conversation,
			value = await client.history(c.bot, c.id);
		if (value.language !== c.language || value.collection_id !== c.collection_id)
			throw new Error("invalid_response");
		state.messages = value.items;
		render();
		status("History loaded. Completed answers can be played after reopening this conversation.");
	}
	async function sendPending() {
		const pending = state.pending,
			c = state.conversation;
		if (!pending || !c) return;
		status(
			pending.kind === "audio"
				? "Recognizing your recording and preparing an answer…"
				: "Preparing your answer…"
		);
		const answer = await (pending.kind === "audio"
			? client.audio(c.bot, c.id, pending.id, pending.body)
			: client.text(c.bot, c.id, pending.id, pending.body));
		state.pending = null;
		clearAudio();
		$("question").value = "";
		if (!state.messages.some((m) => m.turn_id === answer.turn_id))
			state.messages.push(
				{
					role: "user",
					content: answer.transcription?.text ?? pending.body,
					turn_id: answer.turn_id,
				},
				{ role: "assistant", content: answer.answer, turn_id: answer.turn_id }
			);
		render();
		status(
			answer.transcription
				? "Recognized: " + answer.transcription.text
				: "Answer saved to conversation history."
		);
		// The answer is already committed. A later history read must not restore a pending write.
		const history = await client.history(c.bot, c.id);
		state.messages = history.items;
		render();
	}
	async function preview(bytes) {
		const info = inspectWav(bytes, { maxSeconds: state.conversation.language === "rw" ? 15 : 30 });
		clearAudio();
		state.audio = { bytes };
		previewURL = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
		$("input-audio").src = previewURL;
		$("audio-description").textContent =
			"Recording ready · " + info.seconds.toFixed(1) + " seconds. Listen before sending.";
		status("Recording is ready. It has not been uploaded.");
	}
	async function finishRecording() {
		if (!state.recording) return;
		state.recording = false;
		clearInterval(recordTimer);
		await run(async () => {
			const bytes = await mic.stop();
			await preview(bytes);
		});
	}
	async function preparePlayback(turn) {
		stopPlayback();
		const c = state.conversation,
			plan = await client.manifest(c.bot, c.id, turn);
		if (
			plan.language !== c.language ||
			!Array.isArray(plan.segments) ||
			!plan.segments.length ||
			!Array.isArray(plan.voices) ||
			!plan.voices.length
		)
			throw new Error("invalid_audio_response");
		state.playback = { ...plan, turn };
		$("voice").replaceChildren();
		for (const voice of plan.voices) {
			const option = document.createElement("option");
			option.value = voice;
			option.textContent = voice;
			$("voice").append(option);
		}
		$("segment").replaceChildren();
		plan.segments.forEach((_, index) => {
			const option = document.createElement("option");
			option.value = String(index);
			option.textContent = index + 1 + " of " + plan.segments.length;
			$("segment").append(option);
		});
		showSegment();
		$("playback-status").textContent = "Ready";
		status("Playback is separate from answering. Press Play to request audio.");
	}
	function showSegment() {
		if (state.playback)
			$("segment-text").textContent = state.playback.segments[Number($("segment").value)];
	}
	async function playSegment(index, token) {
		if (token !== playRun) return;
		const c = state.conversation,
			plan = state.playback;
		if (index >= plan.segments.length) {
			stopPlayback();
			$("playback-status").textContent = "Finished";
			return;
		}
		$("segment").value = String(index);
		showSegment();
		$("playback-status").textContent =
			"Preparing " + (index + 1) + " of " + plan.segments.length + "…";
		try {
			const voice = $("voice").value,
				result = await client.speech(c.bot, c.id, plan.turn, index, voice, playAbort.signal);
			if (token !== playRun) return;
			if (
				result.language !== c.language ||
				result.segmentCount !== plan.segments.length ||
				result.headers.get("x-speech-voice") !== voice
			)
				throw new Error("invalid_audio_response");
			inspectWav(result.bytes, { rate: 24000, maxSeconds: 30, maxBytes: 1440044 });
			if (answerURL) URL.revokeObjectURL(answerURL);
			answerURL = URL.createObjectURL(new Blob([result.bytes], { type: "audio/wav" }));
			const audio = $("answer-audio");
			audio.src = answerURL;
			audio.onended = () => playSegment(index + 1, token);
			$("playback-status").textContent = "Segment " + (index + 1) + " of " + plan.segments.length;
			try {
				await audio.play();
			} catch {
				if (token === playRun)
					$("playback-status").textContent = "Audio ready—press play on the audio player.";
			}
		} catch (error) {
			if (token !== playRun) return;
			stopPlayback();
			if (error instanceof ApiError && error.status === 401) await expireSession();
			failure(error);
			$("playback-status").textContent = "Playback stopped. The saved answer is unchanged.";
		}
	}
	$("login").onsubmit = (event) => {
		event.preventDefault();
		run(async () => {
			const result = await client.requestCode($("email").value.trim(), $("password").value);
			state.challenge = result.challenge_id;
			$("password").value = "";
			status("If the account is eligible, a code has been emailed. Enter its eight digits.");
		});
	};
	$("verify").onsubmit = (event) => {
		event.preventDefault();
		run(async () => {
			state.session = await client.verify(state.challenge, $("code").value);
			state.challenge = null;
			$("code").value = "";
			status("Signed in. Open a collection or resume a conversation.");
		});
	};
	$("logout").onclick = () =>
		run(async () => {
			stopPlayback();
			await mic.cancel();
			try {
				await client.logout();
			} finally {
				await expireSession();
				status("Local audio and conversation view cleared.");
			}
			status("Signed out.");
		});
	$("language").onchange = sync;
	$("open").onsubmit = (event) => {
		event.preventDefault();
		run(async () => {
			const bot = $("bot").value.trim(),
				resume = $("resume").value.trim();
			let id = resume,
				settings;
			if (resume) settings = await client.history(bot, id);
			else {
				if (!$("collection").value.trim()) throw new Error("missing_collection");
				id = turnId();
				settings = await client.create(bot, id, $("collection").value.trim(), $("language").value);
			}
			state.conversation = {
				bot,
				id,
				collection_id: settings.collection_id,
				language: settings.language,
			};
			$("resume").value = id;
			$("collection").value = settings.collection_id;
			$("language").value = settings.language;
			await loadHistory();
			if (mobile.matches) $("setup").open = false;
		});
	};
	$("compose").onsubmit = (event) => {
		event.preventDefault();
		run(async () => {
			if (!$("question").value.trim()) throw new Error("empty_question");
			state.pending = { kind: "text", id: turnId(), body: $("question").value };
			await sendPending();
		});
	};
	$("refresh").onclick = () => run(loadHistory);
	$("delete").onclick = () =>
		run(async () => {
			const c = state.conversation;
			await client.remove(c.bot, c.id);
			await clearView();
			status("Conversation deleted. Its history and answer playback are no longer available.");
		});
	$("retry").onclick = () => run(sendPending);
	$("discard-pending").onclick = () => {
		state.pending = null;
		clearAudio();
		status("Local pending request discarded. Check history before submitting a new question.");
		sync();
	};
	$("record").onclick = () =>
		run(async () => {
			stopPlayback();
			const seconds = state.conversation.language === "rw" ? 15 : 30;
			await mic.start(seconds, () => finishRecording());
			if (disposed) {
				await mic.cancel();
				return;
			}
			state.recording = true;
			const began = Date.now();
			$("elapsed").textContent = "0 / " + seconds + " s";
			recordTimer = setInterval(() => {
				$("elapsed").textContent =
					Math.min(seconds, Math.floor((Date.now() - began) / 1000)) + " / " + seconds + " s";
			}, 250);
			status("Microphone recording. Finish to review; nothing is uploaded yet.");
		});
	$("stop-record").onclick = finishRecording;
	$("file").onchange = () =>
		run(async () => {
			const file = $("file").files[0];
			if (!file) return;
			if (file.size > 1048576) throw new Error("invalid_audio_size");
			await preview(new Uint8Array(await file.arrayBuffer()));
		});
	$("send-audio").onclick = () =>
		run(async () => {
			state.pending = { kind: "audio", id: turnId(), body: state.audio.bytes };
			clearAudio();
			await sendPending();
		});
	$("discard-audio").onclick = () => {
		clearAudio();
		sync();
		status("Local recording discarded.");
	};
	$("segment").onchange = showSegment;
	$("play").onclick = () => {
		if (!state.playback || state.busy || state.playing) return;
		clearError();
		state.playing = true;
		playAbort = new AbortController();
		const token = ++playRun;
		sync();
		render();
		playSegment(Number($("segment").value), token);
	};
	$("stop-playback").onclick = () => {
		stopPlayback();
		$("playback-status").textContent = "Stopped";
		render();
	};
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		stopPlayback();
		void mic.cancel();
		clearAudio();
		clearInterval(recordTimer);
		state.pending = null;
		state.messages = [];
		state.session = null;
		state.challenge = null;
		state.playback = null;
		client.csrf = "";
		$("password").value = "";
		$("code").value = "";
		mobile.removeEventListener("change", onMobile);
		window.removeEventListener("pagehide", dispose);
		for (const element of root.querySelectorAll("*")) {
			element.onclick = null;
			element.onsubmit = null;
			element.onchange = null;
		}
	};
	window.addEventListener("pagehide", dispose);
	run(async () => {
		try {
			state.session = await client.session();
			status("Signed in. Choose a collection or resume a conversation.");
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				status("Sign in with your ChaBo account to start.");
				return;
			}
			throw error;
		}
	});

	return dispose;
}
