import { browser } from "$app/environment";

/**
 * Whether the document can write and read back a cookie.
 *
 * Note this deliberately does *not* short-circuit on `navigator.cookieEnabled`: that property
 * returns `true` inside a blocked or partitioned third-party iframe, which is exactly the case we
 * need to detect, and short-circuiting on it made every "open in a new tab" fallback dead code.
 *
 * This is necessary but not sufficient — it proves `document.cookie` works, not that the server's
 * `Set-Cookie` survived. Use `serverCookieIsSet()` for that.
 */
export function cookiesAreEnabled(): boolean {
	if (!browser) return false;

	// Create cookie
	document.cookie = "cookietest=1";
	const ret = document.cookie.indexOf("cookietest=") != -1;
	// Delete cookie
	document.cookie = "cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT";
	return ret;
}
