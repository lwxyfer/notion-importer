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

const notionMonthLookup: Record<string, number> = {
	jan: 0,
	january: 0,
	janvier: 0,
	feb: 1,
	february: 1,
	fev: 1,
	fevr: 1,
	fevrier: 1,
	février: 1,
	mar: 2,
	march: 2,
	mars: 2,
	apr: 3,
	april: 3,
	avr: 3,
	avril: 3,
	may: 4,
	mai: 4,
	jun: 5,
	june: 5,
	juin: 5,
	jul: 6,
	july: 6,
	juil: 6,
	juillet: 6,
	aug: 7,
	august: 7,
	aou: 7,
	août: 7,
	aout: 7,
	sep: 8,
	sept: 8,
	september: 8,
	septembre: 8,
	oct: 9,
	october: 9,
	octobre: 9,
	nov: 10,
	november: 10,
	novembre: 10,
	dec: 11,
	december: 11,
	decembre: 11,
	décembre: 11,
};

function sanitizeNotionDateInput(value: string) {
	return value
		.trim()
		.replace(/^@/, '')
		.replace(/\u00A0/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/,/g, ' ')
		.trim();
}

function createLocalDate(year: number, month: number, day = 1, hours = 0, minutes = 0) {
	const date = new Date(year, month, day, hours, minutes, 0, 0);
	return isNaN(date.getTime()) ? null : date;
}

export type NotionDateOrder = 'auto' | 'dmy' | 'mdy';

export function detectDateOrderPreference(values: string[]): NotionDateOrder {
	let dmyScore = 0;
	let mdyScore = 0;

	for (const rawValue of values) {
		const cleaned = sanitizeNotionDateInput(rawValue)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		const match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+\d{1,2}(?::\d{2})?)?$/);
		if (!match) continue;
		const first = Number(match[1]);
		const second = Number(match[2]);
		if (first > 12 && second <= 12) dmyScore++;
		if (second > 12 && first <= 12) mdyScore++;
	}

	if (dmyScore > mdyScore) return 'dmy';
	if (mdyScore > dmyScore) return 'mdy';
	return 'auto';
}

export function parseNotionDateValue(rawValue: string, preferredOrder: NotionDateOrder = 'auto'): Date | null {
	const cleaned = sanitizeNotionDateInput(rawValue);
	if (!cleaned) return null;

	const normalized = cleaned
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

	let match = normalized.match(/^(\d{4})$/);
	if (match) {
		return createLocalDate(Number(match[1]), 0, 1);
	}

	match = normalized.match(/^(\d{1,2})[/-](\d{4})$/);
	if (match) {
		const month = Number(match[1]);
		const year = Number(match[2]);
		if (month >= 1 && month <= 12) {
			return createLocalDate(year, month - 1, 1);
		}
	}

	match = normalized.match(/^(\d{4})[/-](\d{1,2})$/);
	if (match) {
		const year = Number(match[1]);
		const month = Number(match[2]);
		if (month >= 1 && month <= 12) {
			return createLocalDate(year, month - 1, 1);
		}
	}

	match = normalized.match(/^([a-z.]+)\s+(\d{4})$/);
	if (match) {
		const month = notionMonthLookup[match[1].replace(/\./g, '')];
		if (month !== undefined) {
			return createLocalDate(Number(match[2]), month, 1);
		}
	}

	match = normalized.match(/^(\d{4})\s+([a-z.]+)$/);
	if (match) {
		const month = notionMonthLookup[match[2].replace(/\./g, '')];
		if (month !== undefined) {
			return createLocalDate(Number(match[1]), month, 1);
		}
	}

	match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/);
	if (match) {
		const first = Number(match[1]);
		const second = Number(match[2]);
		const year = Number(match[3]);
		const hours = match[4] ? Number(match[4]) : 0;
		const minutes = match[5] ? Number(match[5]) : 0;

		if (first > 12 && second <= 12) {
			return createLocalDate(year, second - 1, first, hours, minutes);
		}
		if (second > 12 && first <= 12) {
			return createLocalDate(year, first - 1, second, hours, minutes);
		}
		if (preferredOrder === 'mdy') {
			return createLocalDate(year, first - 1, second, hours, minutes);
		}
		return createLocalDate(year, second - 1, first, hours, minutes);
	}

	match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/);
	if (match) {
		const year = Number(match[1]);
		const month = Number(match[2]);
		const day = Number(match[3]);
		const hours = match[4] ? Number(match[4]) : 0;
		const minutes = match[5] ? Number(match[5]) : 0;
		return createLocalDate(year, month - 1, day, hours, minutes);
	}

	match = normalized.match(/^(\d{1,2})\s+([a-z.]+)\s+(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/);
	if (match) {
		const day = Number(match[1]);
		const month = notionMonthLookup[match[2].replace(/\./g, '')];
		const year = Number(match[3]);
		const hours = match[4] ? Number(match[4]) : 0;
		const minutes = match[5] ? Number(match[5]) : 0;
		if (month !== undefined) {
			return createLocalDate(year, month, day, hours, minutes);
		}
	}

	match = normalized.match(/^([a-z.]+)\s+(\d{1,2})\s+(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/);
	if (match) {
		const month = notionMonthLookup[match[1].replace(/\./g, '')];
		const day = Number(match[2]);
		const year = Number(match[3]);
		const hours = match[4] ? Number(match[4]) : 0;
		const minutes = match[5] ? Number(match[5]) : 0;
		if (month !== undefined) {
			return createLocalDate(year, month, day, hours, minutes);
		}
	}

	const date = new Date(cleaned);
	return isNaN(date.getTime()) ? null : date;
}

// Convert date strings like "2024/07/22" or "2024/07" to timestamps
export function toTimestamp(dateString: string, preferredOrder: NotionDateOrder = 'auto'): number {
	const date = parseNotionDateValue(dateString, preferredOrder);
	return date ? date.getTime() : 0;
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
