import { base } from "$app/paths";
import { env } from "$env/dynamic/private";
import { collections } from "$lib/server/database";
import { redirect } from "@sveltejs/kit";
import { ObjectId } from "mongodb";

export const load = async ({ params }) => {
	if (env.ENABLE_ASSISTANTS !== "true") {
		redirect(302, `${base}/`);
	}

	try {
		const assistant = await collections.assistants.findOne({
			_id: new ObjectId(params.assistantId),
		});

		if (!assistant) {
			redirect(302, `${base}`);
		}

		return { assistant: JSON.parse(JSON.stringify(assistant)) };
	} catch {
		redirect(302, `${base}`);
	}
};
