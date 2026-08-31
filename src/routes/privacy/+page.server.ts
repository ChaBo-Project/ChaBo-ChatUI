import { readFile } from "node:fs/promises";

export const load = async () => {
	const privacy = await readFile("PRIVACY.md", "utf-8");

	return { privacy };
};
