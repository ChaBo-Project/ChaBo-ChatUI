export function switchTheme() {
	const { classList } = document.querySelector("html") as HTMLElement;
	const metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;

	const theme = classList.contains("dark") ? "light" : "dark";

	classList.toggle("dark", theme === "dark");
	metaTheme?.setAttribute("content", theme === "dark" ? "rgb(26, 36, 50)" : "rgb(249, 250, 251)");

	try {
		localStorage.theme = theme;
	} catch (e) {
		// localStorage throws in a cross-site iframe (Safari/Firefox strict mode). The toggle still
		// applies to this page load, it just won't be remembered.
	}
}
