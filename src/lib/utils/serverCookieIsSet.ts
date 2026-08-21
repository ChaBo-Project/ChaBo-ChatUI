import { browser } from "$app/environment";
import { base } from "$app/paths";

/**
 * Asks the server whether it saw the session cookie on this request. See
 * `src/routes/cookie-check/+server.ts` for why this is the authoritative check — unlike
 * `cookiesAreEnabled()`, it tests the cookie the app actually depends on.
 *
 * Returns `true` when the check could not be performed, so a transient network error never shows
 * the user a scary banner.
 */
export async function serverCookieIsSet(): Promise<boolean> {
	if (!browser) return true;

	try {
		const res = await fetch(`${base}/cookie-check`, { headers: { accept: "application/json" } });
		if (!res.ok) return true;
		const { hasCookie } = await res.json();
		return hasCookie === true;
	} catch {
		return true;
	}
}
