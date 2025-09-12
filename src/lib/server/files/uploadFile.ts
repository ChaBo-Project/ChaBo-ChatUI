import type { Conversation } from "$lib/types/Conversation";
import type { MessageFile } from "$lib/types/Message";
import { sha256 } from "$lib/utils/sha256";
import { fileTypeFromBuffer } from "file-type";
import { collections } from "$lib/server/database";

// MIME types that should be preserved as-is (file-type may not recognize them properly)
const PRESERVE_MIME_TYPES = [
	"application/geojson",
	"application/vnd.geo+json",
	// Add other MIME types here that file-type library has trouble with
];

export async function uploadFile(file: File, conv: Conversation): Promise<MessageFile> {
	const sha = await sha256(await file.text());
	const buffer = await file.arrayBuffer();

	// Attempt to detect the mime type of the file, fallback to the uploaded mime
	// For certain MIME types, preserve the original as file-type may not recognize them properly
	let mime: string;
	if (PRESERVE_MIME_TYPES.includes(file.type)) {
		mime = file.type; // Preserve the original MIME type
	} else {
		mime = await fileTypeFromBuffer(buffer).then((fileType) => fileType?.mime ?? file.type);
	}

	const upload = collections.bucket.openUploadStream(`${conv._id}-${sha}`, {
		metadata: {
			conversation: conv._id.toString(),
			mime,
			originalName: file.name, // Store the original filename in metadata
		},
	});

	upload.write((await file.arrayBuffer()) as unknown as Buffer);
	upload.end();

	// only return the filename when upload throws a finish event or a 20s time out occurs
	return new Promise((resolve, reject) => {
		upload.once("finish", () =>
			resolve({ type: "hash", value: sha, mime: file.type, name: file.name })
		);
		upload.once("error", reject);
		setTimeout(() => reject(new Error("Upload timed out")), 20_000);
	});
}
