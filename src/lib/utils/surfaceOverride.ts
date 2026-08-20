import { env as envPublic } from "$env/dynamic/public";

/**
 * Parses a colour into the space-separated RGB channel form the surface tokens use
 * (see `src/styles/main.css`). Accepts `#rgb`, `#rrggbb`, `rgb(r, g, b)` and a bare `r g b` /
 * `r,g,b` triplet. Returns null for anything it cannot parse, so a typo in the environment leaves
 * the defaults in place instead of producing an invalid stylesheet.
 */
export function toRgbChannels(color: string | undefined): string | null {
	if (!color) return null;

	const value = color.trim();

	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
	if (hex) {
		const digits =
			hex[1].length === 3
				? hex[1]
						.split("")
						.map((c) => c + c)
						.join("")
				: hex[1];
		const int = parseInt(digits, 16);
		// eslint-disable-next-line no-bitwise
		return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
	}

	const channels = value
		.replace(/^rgba?\(/i, "")
		.replace(/\)$/, "")
		.split(/[\s,]+/)
		.filter(Boolean);
	if (channels.length === 3 && channels.every((c) => /^\d+$/.test(c) && Number(c) <= 255)) {
		return channels.join(" ");
	}

	return null;
}

/**
 * A ready-to-inject `<style>` element redefining the surface tokens from the environment, or ""
 * when nothing is configured. Built here rather than in the template because Svelte parses a
 * literal `<style>` tag in markup as a component stylesheet, even inside a template string.
 *
 * Read through `$env/dynamic/public` so a deployment can be recoloured by editing its environment
 * alone — no rebuild, unlike PUBLIC_APP_COLOR which Tailwind bakes in at build time.
 */
export function surfaceOverrideStyleTag(): string {
	const css = surfaceOverrideCss();
	return css ? `<style>${css}</style>` : "";
}

function surfaceOverrideCss(): string {
	// `:root:not(.dark)` and `:root.dark` both have specificity (0,2,0), so they win over the
	// defaults in main.css (`:root` and `.dark`, both (0,1,0)) no matter where the browser ends up
	// ordering this <style> relative to the app stylesheet — which differs between dev, where Vite
	// injects CSS at runtime, and the built bundle. Being mutually exclusive also means a
	// light-only override does not leak into dark mode.
	const rules = (
		[
			[":root:not(.dark)", envPublic.PUBLIC_APP_BACKGROUND, envPublic.PUBLIC_APP_SURFACE],
			[":root.dark", envPublic.PUBLIC_APP_BACKGROUND_DARK, envPublic.PUBLIC_APP_SURFACE_DARK],
		] as const
	)
		.map(([selector, background, surface]) => {
			const declarations = [
				["--app-bg", toRgbChannels(background)],
				["--app-surface", toRgbChannels(surface)],
			].filter(([, channels]) => channels !== null);

			if (!declarations.length) return "";

			return `${selector}{${declarations
				.map(([name, channels]) => `${name}:${channels};`)
				.join("")}}`;
		})
		.filter(Boolean);

	return rules.join("");
}
