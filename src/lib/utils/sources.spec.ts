import { describe, expect, it } from "vitest";
import { citedNumbers, parseMarkdownSources, sourceLabel } from "./sources";

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

describe("citedNumbers", () => {
	it("finds single and grouped citations, sorted and unique", () => {
		expect(citedNumbers("A [4]. B [2, 7]. C [4][1].")).toEqual([1, 2, 4, 7]);
	});

	it("does not read ranges as citations", () => {
		expect(citedNumbers("Rated on a scale of [1-5].")).toEqual([]);
	});

	it("returns nothing for text without citations", () => {
		expect(citedNumbers("No citations here.")).toEqual([]);
	});
});

describe("sourceLabel", () => {
	it("uses the number the source carries", () => {
		expect(sourceLabel({ uri: "doc://#", title: "A", number: 4 }, 0, [2])).toBe(4);
	});

	it("labels every listed source with its own number, cited or not", () => {
		const sources = [1, 2, 3, 4].map((number) => ({ uri: "doc://#", title: `D${number}`, number }));
		expect(sources.map((source, index) => sourceLabel(source, index, [2, 4]))).toEqual([
			1, 2, 3, 4,
		]);
	});

	it("falls back to pairing with the cited numbers when no number was sent", () => {
		const sources = [
			{ uri: "doc://#", title: "D2" },
			{ uri: "doc://#", title: "D4" },
		];
		const cited = citedNumbers("Grouped [2, 4].");
		expect(sources.map((source, index) => sourceLabel(source, index, cited))).toEqual([2, 4]);
	});

	it("falls back to the position when there are more sources than citations", () => {
		expect(sourceLabel({ uri: "doc://#", title: "A" }, 2, [5])).toBe(3);
	});
});
