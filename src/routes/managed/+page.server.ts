import { env } from "$env/dynamic/public";
import { error } from "@sveltejs/kit";
export const load = () => {
	if (env.PUBLIC_MANAGED_CHAT_ENABLED !== "true") throw error(404, "Not found");
	return {};
};
