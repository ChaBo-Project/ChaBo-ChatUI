import { describe, expect, it } from "vitest";
import { parseMarkdownSources } from "./sources";

describe("parseMarkdownSources", () => {
	it("reads the citation number from numbered source lines", () => {
		const block =
			"\n\n**Sources:**\n- [2] [Report A](doc://#)\n- [4] [Report B](https://example.org/b)\n";
		expect(parseMarkdownSources(block)).toEqual([
			{ uri: "doc://#", title: "Report A", number: 2 },
			{ uri: "https://example.org/b", title: "Report B", number: 4 },
		]);
	});

	it("reads no number from an ordered list, whose numbers are only positions", () => {
		const block = "\n\n**Sources:**\n1. [Report A](doc://#)\n2. [Report B](doc://#)\n";
		expect(parseMarkdownSources(block)).toEqual([
			{ uri: "doc://#", title: "Report A" },
			{ uri: "doc://#", title: "Report B" },
		]);
	});

	it("keeps titles that contain dashes and numbers", () => {
		const block = "**Sources:**\n- [11] [Wheat cultivation 2025 MALR.pdf - 24](doc://#)\n";
		expect(parseMarkdownSources(block)).toEqual([
			{ uri: "doc://#", title: "Wheat cultivation 2025 MALR.pdf - 24", number: 11 },
		]);
	});

	it("skips links whose scheme ChatUI does not render", () => {
		const block = "**Sources:**\n- [1] [Local](file:///tmp/a)\n- [2] [Report](doc://#)\n";
		expect(parseMarkdownSources(block)).toEqual([{ uri: "doc://#", title: "Report", number: 2 }]);
	});

	it("returns nothing for a block without links", () => {
		expect(parseMarkdownSources("**Sources:**\n- [1] Untitled\n")).toEqual([]);
	});
});
