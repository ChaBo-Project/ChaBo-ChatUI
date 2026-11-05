<script lang="ts">
	import { onMount } from "svelte";
	import { base } from "$app/paths";
	let root: HTMLElement;
	let startupError = false;
	onMount(() => {
		let active = true,
			dispose: (() => void) | undefined;
		const url = base + "/managed-chat/controller.js";
		import(/* @vite-ignore */ url)
			.then((module) => {
				if (active) dispose = module.mountManaged(root);
			})
			.catch(() => {
				if (active) startupError = true;
			});
		return () => {
			active = false;
			dispose?.();
		};
	});
</script>

<svelte:head
	><title>Document chat · ChaBo</title><link
		rel="stylesheet"
		href={base + "/managed-chat/managed.css"}
	/></svelte:head
>
<div class="managed" bind:this={root}>
	{#if startupError}<p role="alert">Chat could not be loaded. Reload the page to try again.</p>{/if}
	<header>
		<a href={`${base}/`} data-sveltekit-reload>ChaBo</a><span class="badge">Document chat</span><a
			href={`${base}/`}
			class="reference"
			data-sveltekit-reload>Generic chat</a
		>
	</header>
	<main>
		<aside>
			<details id="setup" open>
				<summary>Account and collection</summary>
				<h1>Chat with your documents</h1>
				<p class="muted">Choose a published collection, ask a question, or record your voice.</p>
				<section aria-labelledby="account-title">
					<h2 id="account-title">Account</h2>
					<p id="identity">Checking your session…</p>
					<form id="login" hidden>
						<label>Email<input id="email" type="email" autocomplete="username" required /></label
						><label
							>Password, if configured<input
								id="password"
								type="password"
								autocomplete="current-password"
								maxlength="512"
							/></label
						><button type="submit">Send sign-in code</button>
					</form>
					<form id="verify" hidden>
						<label
							>Eight-digit email code<input
								id="code"
								inputmode="numeric"
								autocomplete="one-time-code"
								pattern={"[0-9]{8}"}
								maxlength="8"
								required
							/></label
						><button type="submit">Sign in</button>
					</form>
					<button id="logout" class="secondary" hidden>Sign out</button>
				</section>
				<section aria-labelledby="conversation-title">
					<h2 id="conversation-title">Conversation</h2>
					<form id="open">
						<fieldset id="settings" disabled>
							<label
								>Bot ID<input
									id="bot"
									value="demo"
									pattern={"[a-z0-9][a-z0-9_-]{0,63}"}
									required
									spellcheck="false"
									autocomplete="off"
								/></label
							>
							<label
								>Published collection ID<input
									id="collection"
									pattern={"[a-f0-9]{32}"}
									maxlength="32"
									spellcheck="false"
									autocomplete="off"
								/></label
							>
							<label
								>Language<select id="language"
									><option value="en">English</option><option value="rw">Kinyarwanda</option
									></select
								></label
							>
							<details>
								<summary>Resume a conversation</summary><label
									>Conversation ID<input
										id="resume"
										pattern={"[a-f0-9]{32}"}
										maxlength="32"
										spellcheck="false"
										autocomplete="off"
									/></label
								>
							</details>
							<button type="submit">Open conversation</button>
						</fieldset>
					</form>
					<p id="binding" class="muted" />
					<p id="rw-notice" hidden>
						Kinyarwanda voice is under evaluation. Recognition may be inaccurate; text chat is
						available.
					</p>
					<button id="delete" class="danger" disabled>Delete conversation</button>
				</section>
			</details>
		</aside>
		<section class="chat" aria-label="Chat">
			<div class="chat-heading">
				<div>
					<h2>Conversation</h2>
					<p id="conversation-label" class="muted">
						Sign in and open a published collection to begin.
					</p>
				</div>
				<button id="refresh" class="secondary" disabled>Check history</button>
			</div>
			<div id="status" role="status" aria-live="polite">
				Sign in with your ChaBo account to use a published document collection.
			</div>
			<div id="error" role="alert" hidden />
			<div id="messages" aria-label="Conversation history">
				<p class="empty">Your questions and answers will appear here.</p>
			</div>
			<section id="playback" aria-label="Answer playback" hidden>
				<div class="playback-heading">
					<strong>Answer playback</strong><span id="playback-status" class="muted" />
				</div>
				<label>Voice<select id="voice" /></label><label>Segment<select id="segment" /></label>
				<p id="segment-text" />
				<button id="play">Play from this segment</button><button
					id="stop-playback"
					class="secondary">Stop</button
				>
				<audio id="answer-audio" controls preload="none" />
			</section>
			<form id="compose">
				<fieldset id="question-controls" disabled>
					<label for="question">Question</label><textarea
						id="question"
						rows="3"
						maxlength="4000"
						placeholder="Ask about your published documents"
					/>
					<div class="actions">
						<button type="submit">Send question</button><button
							id="record"
							type="button"
							class="secondary">Record voice</button
						><label class="file-label"
							>Choose PCM WAV<input id="file" type="file" accept="audio/wav,.wav" /></label
						>
					</div>
				</fieldset>
			</form>
			<section id="recording" hidden>
				<strong>Recording…</strong> <span id="elapsed" aria-hidden="true" /><button
					id="stop-record"
					class="secondary">Finish recording</button
				>
			</section>
			<section id="audio-preview" hidden>
				<p id="audio-description" />
				<audio id="input-audio" controls preload="none" /><button id="send-audio"
					>Send voice question</button
				><button id="discard-audio" class="secondary">Discard recording</button>
			</section>
			<section id="recovery" hidden>
				<p>
					The request outcome may be uncertain. Check history before starting another question. A
					retry uses the same turn ID and exact content.
				</p>
				<code id="pending-id" /><button id="retry">Retry same request</button><button
					id="discard-pending"
					class="secondary">Discard local pending request</button
				>
			</section>
			<p class="muted privacy">
				Microphone access starts only when you press Record. Review the recording before sending.
				Local audio is cleared when you leave or sign out. Conversation text follows the server
				history policy.
			</p>
		</section>
	</main>
</div>
