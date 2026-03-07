import { parseFilePath } from '../../filesystem.js';

export const stripNotionId = (id: string) => {
	return id.replace(/-/g, '').replace(/[ -]?[a-f0-9]{32}(\.|$)/, '$1');
};

// Notion UUIDs come at the end of filenames/URL paths and are always 32 characters long.
export const getNotionId = (id: string) => {
	return id.replace(/-/g, '').match(/([a-f0-9]{32})(\?|\.|$)/)?.[1];
};

export function normalizeNotionLookup(value: string) {
	let normalized = value ?? '';
	try {
		normalized = decodeURI(normalized);
	} catch {
		// Keep the raw value if the export already contains decoded characters.
	}
	return normalized
		.normalize('NFC')
		.replace(/\\/g, '/')
		.replace(/^\.?\//, '')
		.replace(/\/+/g, '/')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

export const parseParentIds = (filename: string) => {
	const { parent } = parseFilePath(filename);
	return parent
		.split('/')
		.map((parentNote) => getNotionId(parentNote))
		.filter((id) => id) as string[];
};

export function stripParentDirectories(relativeURI: string) {
	return relativeURI.replace(/^(\.\.\/)+/, '');
}

export function escapeHashtags(body: string) {
	const tagExp = /#[a-z0-9\-]+/gi;

	if (!tagExp.test(body)) return body;
	const lines = body.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const hashtags = lines[i].match(tagExp);
		if (!hashtags) continue;
		let newLine = lines[i];
		for (let hashtag of hashtags) {
			// skipping any internal links [[ # ]], URLS [ # ]() or []( # ), or already escaped hashtags \#, replace all tag-like things #<word> in the document with \#<word>. Useful for programs (like Notion) that don't support #<word> tags.
			const hashtagInLink = new RegExp(
				`\\[\\[[^\\]]*${hashtag}[^\\]]*\\]\\]|\\[[^\\]]*${hashtag}[^\\]]*\\]\\([^\\)]*\\)|\\[[^\\]]*\\]\\([^\\)]*${hashtag}[^\\)]*\\)|\\\\${hashtag}`
			);

			if (hashtagInLink.test(newLine)) continue;
			newLine = newLine.replace(hashtag, '\\' + hashtag);
		}
		lines[i] = newLine;
	}
	body = lines.join('\n');
	return body;
}

/**
 * Hoists all child nodes of this node to where this node used to be,
 * removing this node altogether from the DOM.
 */
export function hoistChildren(el: ChildNode) {
	el.replaceWith(...Array.from(el.childNodes));
}

// Convert date strings like "2024/07/22" or "2024/07/22 8:15" to timestamps
export function toTimestamp(dateString: string): number {
	// When the time part is missing, JavaScript defaults to 00:00:00
	const date = new Date(dateString);

	if (isNaN(date.getTime())) {
		return 0;
	}

	// Return timestamp in milliseconds
	return date.getTime();
}

// Parse numbers in European format ("60,00 €", "3 388,00", "192.00", etc.)
export function parseEuropeanNumber(raw: string): { value: number; formatted: string } | null {
	if (!raw || !raw.trim()) return null;

	let s = raw.trim();

	// Remove currency symbols and currency codes
	s = s.replace(/[€$£¥₹]/g, '').trim();
	s = s.replace(/\b(EUR|USD|GBP|CHF|JPY|CAD|AUD)\b/gi, '').trim();

	// Remove non-breaking spaces and regular spaces (thousand separators)
	s = s.replace(/[\s\u00A0\u202F]/g, '');

	// Handle percentage
	const isPercent = s.includes('%');
	s = s.replace(/%/g, '').trim();

	if (!s) return null;

	// Detect format by position of last comma vs last dot
	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');

	if (lastComma > lastDot) {
		// European: "3.388,00" or "60,00" -- comma is decimal
		s = s.replace(/\./g, '').replace(',', '.');
	} else if (lastDot > lastComma) {
		// US/international: "3,388.00" or "60.00" -- dot is decimal
		s = s.replace(/,/g, '');
	} else if (lastComma >= 0 && lastDot < 0) {
		// Only comma: "60,00" -> decimal if <= 2 digits after
		const afterComma = s.split(',')[1];
		if (afterComma && afterComma.length <= 2) {
			s = s.replace(',', '.');
		} else {
			s = s.replace(/,/g, '');
		}
	}

	const num = Number(s);
	if (isNaN(num)) return null;

	return {
		value: isPercent ? num / 100 : num,
		formatted: raw.trim(),
	};
}

// Check if a timestamp represents a pure date (no time component)
export function timestampIsPrueDate(timestamp: number) {
	const date = new Date(timestamp);
	return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}
