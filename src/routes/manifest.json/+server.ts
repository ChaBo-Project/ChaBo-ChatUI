import { base } from "$app/paths";
import { env as envPublic } from "$env/dynamic/public";
import { json } from "@sveltejs/kit";

/**
 * Served as a route rather than shipped as a static file so the installed-app name follows
 * PUBLIC_APP_NAME. The static `static/$PUBLIC_APP_ASSETS/manifest.json` hardcoded "Chat UI",
 * which is wrong for every deployment that renames the app.
 */
export async function GET() {
	const assets = `${base}/${envPublic.PUBLIC_APP_ASSETS}`;
	const name = envPublic.PUBLIC_APP_NAME || "Chat UI";

	return json(
		{
			background_color: "#ffffff",
			name,
			short_name: name,
			display: "standalone",
			start_url: `${base}/`,
			icons: [128, 256, 512].map((size) => ({
				src: `${assets}/icon-${size}x${size}.png`,
				sizes: `${size}x${size}`,
				type: "image/png",
			})),
		},
		{ headers: { "content-type": "application/manifest+json" } }
	);
}
