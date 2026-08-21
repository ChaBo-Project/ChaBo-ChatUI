const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "class",
	mode: "jit",
	content: ["./src/**/*.{html,js,svelte,ts}"],
	theme: {
		extend: {
			colors: {
				primary: colors[process.env.PUBLIC_APP_COLOR],
				// Runtime-overridable surface tokens, defined in src/styles/main.css.
				app: {
					bg: "rgb(var(--app-bg) / <alpha-value>)",
					surface: "rgb(var(--app-surface) / <alpha-value>)",
					"surface-muted": "rgb(var(--app-surface-muted) / <alpha-value>)",
				},
			},
			fontSize: {
				xxs: "0.625rem",
				smd: "0.94rem",
			},
		},
	},
	plugins: [
		require("tailwind-scrollbar")({ nocompatible: true }),
		require("@tailwindcss/typography"),
	],
};
