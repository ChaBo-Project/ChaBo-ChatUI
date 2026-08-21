import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";

/**
 * Round-trip probe for the session cookie.
 *
 * The page load hands the browser a `Set-Cookie` for the session (see `hooks.server.ts`). If the
 * browser accepted it, it comes back on this request. If third-party cookies are blocked — the app
 * is framed and the cookie is cross-site — it does not, and every subsequent write will land under
 * a fresh, throwaway session. The client uses this to warn the user instead of letting them hit an
 * unexplained failure on their first message.
 */
export async function GET({ cookies }) {
	return json(
		{ hasCookie: !!cookies.get(env.COOKIE_NAME) },
		{ headers: { "cache-control": "no-store" } }
	);
}
