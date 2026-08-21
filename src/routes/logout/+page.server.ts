import { base } from "$app/paths";
import { env } from "$env/dynamic/private";
import { collections } from "$lib/server/database";
import { sessionCookieOptions } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";

export const actions = {
	async default({ cookies, locals }) {
		await collections.sessions.deleteOne({ sessionId: locals.sessionId });

		// The attributes have to match the ones the cookie was set with, otherwise the browser
		// keeps it — hence reusing `sessionCookieOptions` instead of duplicating them here.
		cookies.delete(env.COOKIE_NAME, sessionCookieOptions);
		redirect(303, `${base}/`);
	},
};
