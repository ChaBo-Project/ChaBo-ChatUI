import { buildPrompt } from "$lib/buildPrompt";
import { z } from "zod";
import type { Endpoint, EndpointMessage } from "../endpoints";
import type { TextGenerationStreamOutput } from "@huggingface/inference";
import { logger } from "$lib/server/logger";

export const endpointLangserveParametersSchema = z.object({
	weight: z.number().int().positive().default(1),
	model: z.any(),
	type: z.literal("langserve"),
	url: z.string().url(),
	// Add new optional fields for file upload support
	fileUploadUrl: z.string().url().optional(),
	inputKey: z.string().default("text"),
});

export function endpointLangserve(
	input: z.input<typeof endpointLangserveParametersSchema>
): Endpoint {
	const { url, model, fileUploadUrl, inputKey } = endpointLangserveParametersSchema.parse(input);

	return async ({ messages, preprompt, continueMessage }) => {
		const prompt = await buildPrompt({
			messages,
			continueMessage,
			preprompt,
			model,
		});

		// Check if any message has files
		const hasFiles = messages.some((message) => message.files && message.files.length > 0);

		// If files are present and fileUploadUrl is configured, use file upload endpoint
		if (hasFiles && fileUploadUrl) {
			return handleFileUpload(fileUploadUrl, messages, prompt);
		} else {
			// Use the regular text-only endpoint
			return handleTextOnly(url, prompt, inputKey);
		}
	};
}

async function* handleFileUpload(
	fileUploadUrl: string,
	messages: EndpointMessage[],
	prompt: string
	// inputKey: string
): AsyncGenerator<TextGenerationStreamOutput> {
	// Find the latest user message with files
	const latestUserMessage = messages
		.filter((msg) => msg.from === "user")
		.reverse()
		.find((msg) => msg.files && msg.files.length > 0);

	if (!latestUserMessage?.files) {
		throw new Error("No files found in user messages");
	}

	// Create FormData for file upload
	const formData = new FormData();
	formData.append("query", prompt);

	// Add files to form data
	for (const file of latestUserMessage.files) {
		if (file.type === "base64") {
			// Convert base64 to buffer
			const buffer = Buffer.from(file.value, "base64");

			// Create a proper File object with the correct name and mime type
			const fileBlob = new Blob([buffer as unknown as BlobPart], { type: file.mime });

			// Ensure the filename has the correct extension based on mime type
			let filename = file.name;

			// If filename doesn't have an extension, add one based on mime type
			if (!filename.includes(".")) {
				if (file.mime === "application/pdf") {
					filename = filename + ".pdf";
				} else if (
					file.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
				) {
					filename = filename + ".docx";
				} else if (file.mime === "application/msword") {
					filename = filename + ".doc";
				} else if (file.mime === "application/geojson") {
					filename = filename + ".geojson";
				} else if (file.mime === "text/plain") {
					filename = filename + ".txt";
				}
			}

			// Create a File object from the Blob to preserve the filename
			const fileObject = new File([fileBlob], filename, { type: file.mime });
			formData.append("file", fileObject);
		}
	}

	// Add optional parameters (you can customize these based on your ChatFed API)
	formData.append("reports_filter", "");
	formData.append("sources_filter", "");
	formData.append("subtype_filter", "");
	formData.append("year_filter", "");
	formData.append("session_id", `session_${Date.now()}`);
	formData.append("user_id", "chatui_user");

	const r = await fetch(fileUploadUrl, {
		method: "POST",
		headers: {
			Accept: "application/json",
		},
		body: formData,
	});

	if (!r.ok) {
		const errorText = await r.text();
		logger.error(`File upload failed: ${r.status} ${r.statusText} - ${errorText}`);
		throw new Error(`Failed to generate text: ${errorText}`);
	}

	// Handle the response - try streaming first, fallback to non-streaming
	return yield* handleResponse(r);
}

async function* handleTextOnly(
	url: string,
	prompt: string,
	inputKey: string
): AsyncGenerator<TextGenerationStreamOutput> {
	const r = await fetch(`${url}/stream`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			input: { [inputKey]: prompt },
		}),
	});

	if (!r.ok) {
		throw new Error(`Failed to generate text: ${await r.text()}`);
	}

	// Handle the response - try streaming first, fallback to non-streaming
	return yield* handleResponse(r);
}

async function* handleResponse(r: Response): AsyncGenerator<TextGenerationStreamOutput> {
	const contentType = r.headers.get("content-type") || "";

	// Check if it's a streaming response
	if (
		contentType.includes("text/event-stream") ||
		contentType.includes("application/stream+json")
	) {
		return yield* handleStreamingResponse(r);
	} else {
		// Handle non-streaming response
		return yield* handleNonStreamingResponse(r);
	}
}

async function* handleStreamingResponse(r: Response): AsyncGenerator<TextGenerationStreamOutput> {
	const encoder = new TextDecoderStream();
	const reader = r.body?.pipeThrough(encoder).getReader();

	let stop = false;
	let generatedText = "";
	let tokenId = 0;
	let accumulatedData = "";

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
		const eventData = out.value;

		while (accumulatedData.includes("\n")) {
			const endIndex = accumulatedData.indexOf("\n");
			let jsonString = accumulatedData.substring(0, endIndex).trim();
			accumulatedData = accumulatedData.substring(endIndex + 1);

			if (eventData.startsWith("event: end")) {
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
				} satisfies TextGenerationStreamOutput;
				reader?.cancel();
				continue;
			}

			if (eventData.startsWith("event: data") && jsonString.startsWith("data: ")) {
				jsonString = jsonString.slice(6);
				let data = null;

				try {
					data = JSON.parse(jsonString);
				} catch (e) {
					logger.error(e, "Failed to parse JSON");
					logger.error(jsonString, "Problematic JSON string:");
					continue;
				}

				if (data) {
					generatedText += data;
					const output: TextGenerationStreamOutput = {
						token: {
							id: tokenId++,
							text: data,
							logprob: 0,
							special: false,
						},
						generated_text: null,
						details: null,
					};
					yield output;
				}
			}
		}
	}
}

async function* handleNonStreamingResponse(
	r: Response
): AsyncGenerator<TextGenerationStreamOutput> {
	const responseText = await r.text();
	let tokenId = 0;

	// Try to parse as JSON first
	try {
		const jsonResponse = JSON.parse(responseText);

		// Handle different possible response formats
		let text = "";
		if (typeof jsonResponse === "string") {
			text = jsonResponse;
		} else if (jsonResponse.output && typeof jsonResponse.output === "string") {
			text = jsonResponse.output;
		} else if (jsonResponse.response && typeof jsonResponse.response === "string") {
			text = jsonResponse.response;
		} else if (jsonResponse.text && typeof jsonResponse.text === "string") {
			text = jsonResponse.text;
		} else if (jsonResponse.content && typeof jsonResponse.content === "string") {
			text = jsonResponse.content;
		} else if (jsonResponse.data && typeof jsonResponse.data === "string") {
			text = jsonResponse.data;
		} else if (jsonResponse.result && typeof jsonResponse.result === "string") {
			text = jsonResponse.result;
		} else {
			// If no recognizable field, try to extract text from the entire object
			text = JSON.stringify(jsonResponse);
		}

		// Split text into tokens and yield them
		const tokens = text.split(/(\s+)/);
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token) {
				yield {
					token: {
						id: tokenId++,
						text: token,
						logprob: 0,
						special: false,
					},
					generated_text: null,
					details: null,
				} satisfies TextGenerationStreamOutput;
			}
		}

		// Yield final token
		yield {
			token: {
				id: tokenId++,
				text: "",
				logprob: 0,
				special: true,
			},
			generated_text: text,
			details: null,
		} satisfies TextGenerationStreamOutput;
	} catch (e) {
		// If JSON parsing fails, treat as plain text
		const text = responseText;

		// Split text into tokens and yield them
		const tokens = text.split(/(\s+)/);
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token) {
				yield {
					token: {
						id: tokenId++,
						text: token,
						logprob: 0,
						special: false,
					},
					generated_text: null,
					details: null,
				} satisfies TextGenerationStreamOutput;
			}
		}

		// Yield final token
		yield {
			token: {
				id: tokenId++,
				text: "",
				logprob: 0,
				special: true,
			},
			generated_text: text,
			details: null,
		} satisfies TextGenerationStreamOutput;
	}
}

export default endpointLangserve;
