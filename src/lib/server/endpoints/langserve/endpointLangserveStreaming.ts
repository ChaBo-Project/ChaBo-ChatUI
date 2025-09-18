import { buildPrompt } from "$lib/buildPrompt";
import { z } from "zod";
import type { Endpoint, EndpointMessage } from "../endpoints";
import type { TextGenerationStreamOutput } from "@huggingface/inference";
import { logger } from "$lib/server/logger";

export const endpointLangserveStreamingParametersSchema = z.object({
	weight: z.number().int().positive().default(1),
	model: z.any(),
	type: z.literal("langserve-streaming"),
	url: z.string().url(),
	streamingFileUploadUrl: z.string().url(),
	inputKey: z.string().default("text"),
	fileInputKey: z.string().default("files"),
});

export function endpointLangserveStreaming(
	input: z.input<typeof endpointLangserveStreamingParametersSchema>
): Endpoint {
	const { url, model, streamingFileUploadUrl, inputKey, fileInputKey } =
		endpointLangserveStreamingParametersSchema.parse(input);

	return async ({ messages, preprompt, continueMessage }) => {
		const prompt = await buildPrompt({
			messages,
			continueMessage,
			preprompt,
			model,
		});

		// Check if any message has files
		const hasFiles = messages.some((message) => message.files && message.files.length > 0);

		if (hasFiles) {
			return handleStreamingFileUpload(
				streamingFileUploadUrl,
				messages,
				prompt,
				inputKey,
				fileInputKey
			);
		} else {
			// Use the regular text-only streaming endpoint
			return handleTextOnlyStreaming(url, prompt, inputKey);
		}
	};
}

async function* handleStreamingFileUpload(
	streamingFileUploadUrl: string,
	messages: EndpointMessage[],
	prompt: string,
	inputKey: string,
	fileInputKey: string
): AsyncGenerator<TextGenerationStreamOutput> {
	// Find the latest user message with files
	const latestUserMessage = messages
		.filter((msg) => msg.from === "user")
		.reverse()
		.find((msg) => msg.files && msg.files.length > 0);

	if (!latestUserMessage?.files) {
		throw new Error("No files found in user messages");
	}

	// Prepare file data for JSON payload (streaming endpoints typically use JSON)
	const fileData = await Promise.all(
		latestUserMessage.files.map(async (file) => {
			if (file.type === "base64") {
				return {
					name: file.name,
					mime: file.mime,
					content: file.value,
					type: "base64",
				};
			}
			return null;
		})
	);

	const validFiles = fileData.filter((f) => f !== null);

	// Use JSON payload for streaming endpoint
	const payload = {
		input: {
			[inputKey]: prompt,
			[fileInputKey]: validFiles,
		},
	};

	const r = await fetch(`${streamingFileUploadUrl}/stream`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		},
		body: JSON.stringify(payload),
	});

	if (!r.ok) {
		const errorText = await r.text();
		logger.error(`Streaming file upload failed: ${r.status} ${r.statusText} - ${errorText}`);
		throw new Error(`Failed to generate text: ${errorText}`);
	}

	// Handle the streaming response
	return yield* handleStreamingResponse(r);
}

async function* handleTextOnlyStreaming(
	url: string,
	prompt: string,
	inputKey: string
): AsyncGenerator<TextGenerationStreamOutput> {
	const r = await fetch(`${url}/stream`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		},
		body: JSON.stringify({
			input: { [inputKey]: prompt },
		}),
	});

	if (!r.ok) {
		throw new Error(`Failed to generate text: ${await r.text()}`);
	}

	return yield* handleStreamingResponse(r);
}

async function* handleStreamingResponse(r: Response): AsyncGenerator<TextGenerationStreamOutput> {
	const encoder = new TextDecoderStream();
	const reader = r.body?.pipeThrough(encoder).getReader();

	let stop = false;
	let generatedText = "";
	let tokenId = 0;
	let accumulatedData = "";
	let webSources: { uri: string; title: string }[] | null = null;

	while (!stop) {
		const out = (await reader?.read()) ?? { done: false, value: undefined };

		if (out.done) {
			reader?.cancel();
			return;
		}

		if (!out.value) {
			return;
		}

		accumulatedData += out.value;

		// Process complete lines
		while (accumulatedData.includes("\n")) {
			const endIndex = accumulatedData.indexOf("\n");
			const line = accumulatedData.substring(0, endIndex).trim();
			accumulatedData = accumulatedData.substring(endIndex + 1);

			// Handle Server-Sent Events format
			if (line.startsWith("event: ")) {
				const eventType = line.substring(7);
				if (eventType === "end" || eventType === "done") {
					stop = true;
					yield {
						token: {
							id: tokenId++,
							text: "",
							logprob: 0,
							special: true,
						},
						generated_text: generatedText,
						details: null,
						webSources,
					} satisfies TextGenerationStreamOutput;
					reader?.cancel();
					continue;
				}
			}

			if (line.startsWith("data: ")) {
				const jsonString = line.substring(6);

				// Handle end marker
				if (jsonString === "[DONE]") {
					stop = true;
					yield {
						token: {
							id: tokenId++,
							text: "",
							logprob: 0,
							special: true,
						},
						generated_text: generatedText,
						details: null,
						webSources,
					} satisfies TextGenerationStreamOutput;
					reader?.cancel();
					continue;
				}

				try {
					const data = JSON.parse(jsonString);

					// Extract webSources if present
					if (data.webSources && Array.isArray(data.webSources)) {
						webSources = data.webSources;
					} else if (data.sources && Array.isArray(data.sources)) {
						// Handle alternative naming
						webSources = data.sources;
					}

					// Extract token text from various possible formats
					let tokenText = "";
					if (typeof data === "string") {
						tokenText = data;
					} else if (data.token) {
						tokenText = data.token;
					} else if (data.text) {
						tokenText = data.text;
					} else if (data.content) {
						tokenText = data.content;
					} else if (data.delta && data.delta.content) {
						tokenText = data.delta.content;
					}

					if (tokenText) {
						generatedText += tokenText;
						const output: TextGenerationStreamOutput = {
							token: {
								id: tokenId++,
								text: tokenText,
								logprob: 0,
								special: false,
							},
							generated_text: null,
							details: null,
						};
						yield output;
					}
				} catch (e) {
					logger.error(e, "Failed to parse streaming JSON");
					logger.error(jsonString, "Problematic JSON string:");
					continue;
				}
			}
		}
	}
}

export default endpointLangserveStreaming;
