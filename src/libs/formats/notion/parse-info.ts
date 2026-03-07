import { assetBaseDir, calculateMD5, parseHTML, sanitizeFileName } from '../../util.js';
import { ZipEntryFile } from '../../zip.js';
import { NotionResolverInfo } from './notion-types.js';
import { getNotionId, parseNotionDateValue, parseParentIds } from './notion-utils.js';

const PAGE_SECTION_HEADINGS = new Set(['pages', 'sous-pages', 'sub-pages', 'subpages', 'page']);

/**
 * Returns true if the page body contains real content beyond the auto-generated
 * "Pages" section (hr + h2 + figure.link-to-page list) that Notion appends to
 * every page with child pages.
 */
function pageHasRealContent(dom: HTMLElement): boolean {
	const body = dom.querySelector('div[class=page-body]') as HTMLElement | null;
	if (!body || !body.innerHTML.trim()) return false;

	// Clone and strip the "Pages" section to check if anything else remains
	const clone = body.cloneNode(true) as HTMLElement;

	// Strip display:contents wrappers (same logic as cleanInvalidDOM)
	for (const wrapper of Array.from(clone.querySelectorAll('div[style*="display:contents"]')).reverse()) {
		wrapper.replaceWith(...Array.from(wrapper.childNodes));
	}

	// Remove hr + heading + figure.link-to-page section
	for (const h of Array.from(clone.querySelectorAll('h1, h2, h3'))) {
		if (!PAGE_SECTION_HEADINGS.has(h.textContent?.trim().toLowerCase() ?? '')) continue;
		const prev = h.previousElementSibling;
		if (prev?.tagName === 'HR') prev.remove();
		let next = h.nextElementSibling;
		while (next?.tagName === 'FIGURE' && next.classList.contains('link-to-page')) {
			const tmp = next.nextElementSibling;
			next.remove();
			next = tmp;
		}
		h.remove();
		break;
	}

	return Boolean(clone.innerHTML.trim());
}

export async function parseFileInfo(info: NotionResolverInfo, file: ZipEntryFile) {
	let { filepath } = file;

	if (file.extension === 'html') {
		const text = await file.readText();

		const dom = parseHTML(text);
		const body = dom.querySelector('body');
		const children = body.children;
		let id: string | undefined;
		for (let i = 0; i < children.length; i++) {
			id = getNotionId(children[i].getAttribute('id') ?? '');
			if (id) break;
		}
		if (!id) {
			throw new Error('no id found for: ' + filepath);
		}

		const ctime = extractTimeFromDOMElement(dom, 'property-row-created_time');
		const mtime = extractTimeFromDOMElement(dom, 'property-row-last_edited_time');

		// Because Notion cuts titles to be very short and chops words in half, we read the complete title from the HTML to get full words. Worth the extra processing time.
		const parsedTitle = dom.querySelector('title')?.textContent || 'Untitled';

		let title = stripTo200(sanitizeFileName(
			parsedTitle
				.replace(/\n/g, ' ')
				.replace(/[:\/]/g, '-')
				.replace(/#/g, '')
				.trim()
		)); 

		info.idsToFileInfo[id] = {
			path: filepath,
			parentIds: parseParentIds(filepath),
			ctime,
			mtime,
			title,
			displayTitle: title,
			blockID: '',
			hasContent: pageHasRealContent(dom)
		};
	}
	else {
        let hashFileName = calculateMD5(file.fullpath);
        let nameWithExtension = decodeURI(sanitizeFileName(file.name));
        const parts = nameWithExtension.split('.');
        let fileExt = '';
        if (parts.length > 1) {
            fileExt = parts.pop() ?? '';
        }
        let displayPathInSiYuan = `${assetBaseDir}/notion/${hashFileName.substring(0, 2)}/${hashFileName}.${fileExt}`
		info.pathsToAttachmentInfo[filepath] = {
			path: filepath,
			parentIds: parseParentIds(filepath),
			nameWithExtension: nameWithExtension,
			targetParentFolder: '',
            pathInSiYuanMd: displayPathInSiYuan,
            pathInSiYuanFs: `/data/${displayPathInSiYuan}`
		};
	}
}

function stripTo200(title: string) {
	if (title.length < 200) return title;	
	
	// just in case title names are too long
	const wordList = title.split(' ');
	const titleList = [];
	let length = 0;
	let i = 0;
	let hasCompleteTitle = false;
	while (length < 200) {
		if (!wordList[i]) {
			hasCompleteTitle = true;
			break;
		}
		titleList.push(wordList[i]);
		length += wordList[i].length + 1;
		i++;
	}
	let strippedTitle = titleList.join(' ');
	if (!hasCompleteTitle) strippedTitle += '...';
	return strippedTitle;
}

// Function to parse the date-time string
function parseDateTime(dateTimeStr: string): Date | null {
	return parseNotionDateValue(dateTimeStr);
}

function extractTimeFromDOMElement(dom: HTMLElement, trClassName: string): Date | null {
	// Select the <tr> element with the specified class from the provided DOM
	const trElement = dom.querySelector(`tr.${trClassName}`);

	if (trElement) {
		// If the <tr> element exists, select the <time> element within it
		const timeElement = trElement.querySelector('time');

		// Return the inner text of the <time> element or null if not found
		return timeElement && timeElement.textContent ? parseDateTime(timeElement.textContent) : null;
	}

	return null;
}
