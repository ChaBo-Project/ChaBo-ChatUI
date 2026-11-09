/**
 * Sources sent by the ChaBo Orchestrator as a markdown block at the end of an answer.
 *
 * `number` is the citation number the answer uses for the source (`[n]`). Orchestrators that
 * label each line `- [n] [title](uri)` send it; older ones send a plain `1. [title](uri)`
 * list whose numbers are list positions, not citation numbers, so no `number` is read there.
 */
export interface CitedSource {
	uri: string;
	title: string;
	number?: number;
}

// A [title](uri) link with a scheme ChatUI renders (unchanged from the original parser).
const SOURCE_LINK = /\[([^\]]+)\]\(((?:doc|https?):\/\/[^)]+)\)/g;
// A source line that states its citation number: "- [2] [title](uri)" (or "* [2] ...").
const NUMBERED_LINE = /^\s*[-*]\s+\[(\d+)\]\s+/;

/** Read the sources from a markdown block containing "**Sources:**". */
export function parseMarkdownSources(text: string): CitedSource[] {
	const sources: CitedSource[] = [];
	for (const line of text.split("\n")) {
		const numbered = line.match(NUMBERED_LINE);
		for (const [, title, uri] of line.matchAll(SOURCE_LINK)) {
			sources.push(numbered ? { uri, title, number: Number(numbered[1]) } : { uri, title });
		}
	}
	return sources;
}

// "[2]", grouped "[1, 3]" and ranged "[1-3]" / "[1–3]" citations in answer text.
const CITATION = /\[([\d,\s\-–]+)\]/g;
// Widest "[a-b]" range read as citations; wider spans (e.g. years) are not citations.
const MAX_CITATION_RANGE = 50;

/** The sorted, unique citation numbers found in an answer's text. */
export function citedNumbers(text: string): number[] {
	const numbers = new Set<number>();
	for (const [, group] of text.matchAll(CITATION)) {
		for (const part of group.split(",")) {
			const bounds = (part.match(/\d+/g) ?? []).map(Number);
			if (bounds.length === 1) {
				numbers.add(bounds[0]);
			} else if (bounds.length === 2 && bounds[1] >= bounds[0]) {
				if (bounds[1] - bounds[0] <= MAX_CITATION_RANGE) {
					for (let n = bounds[0]; n <= bounds[1]; n++) numbers.add(n);
				}
			}
		}
	}
	return [...numbers].sort((a, b) => a - b);
}

/**
 * The citation number to show on the chip for `source`, the `index`-th listed source.
 *
 * Uses the number the Orchestrator sent. Sources without one (older Orchestrators, stored
 * conversations) fall back to pairing the listed sources with the cited numbers in order,
 * which holds while the list contains exactly the cited sources.
 */
export function sourceLabel(source: CitedSource, index: number, cited: number[]): number {
	return source.number ?? (cited[index] || index + 1);
}
