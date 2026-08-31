import { env } from "$env/dynamic/private";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";

export async function GET({ params }) {
	if (env.ENABLE_ASSISTANTS !== "true") {
		return Response.json({ message: "Assistant not found" }, { status: 404 });
	}

	const id = params.id;
	const assistantId = new ObjectId(id);

	const assistant = await collections.assistants.findOne({
		_id: assistantId,
	});

	if (assistant) {
		return Response.json(assistant);
	} else {
		return Response.json({ message: "Assistant not found" }, { status: 404 });
	}
}
