import { collections } from "$lib/server/database";
import type { Conversation } from "$lib/types/Conversation";
// import type { Message } from "$lib/types/Message";
import { logger } from "$lib/server/logger";

/**
 * Removes files from GridFS and strips file references from user messages after they've been sent to the model.
 * This prevents re-sending files on subsequent conversation turns and frees up storage.
 */
export async function cleanupFilesAfterSending(conv: Conversation): Promise<void> {
	let filesCleanedCount = 0;

	// Find all user messages with files
	for (const message of conv.messages) {
		if (message.from !== "user" || !message.files || message.files.length === 0) {
			continue;
		}

		// Delete files from GridFS
		for (const file of message.files) {
			if (file.type === "hash") {
				try {
					const filename = `${conv._id.toString()}-${file.value}`;
					const fileDoc = await collections.bucket.find({ filename }).next();

					if (fileDoc) {
						await collections.bucket.delete(fileDoc._id);
						filesCleanedCount++;
						logger.info(`Deleted file from GridFS: ${filename}`);
					}
				} catch (error) {
					logger.error(error, `Failed to delete file from GridFS: ${file.name}`);
				}
			}
		}

		// Remove file references from the message
		message.files = [];
	}

	if (filesCleanedCount > 0) {
		// Update the conversation in the database
		await collections.conversations.updateOne(
			{ _id: conv._id },
			{ $set: { messages: conv.messages, updatedAt: new Date() } }
		);

		logger.info(`Cleaned up ${filesCleanedCount} file(s) from conversation ${conv._id.toString()}`);
	}
}
