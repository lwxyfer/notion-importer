import { resolveFallbackParentIDsFromResolver } from './export-parser.js';
import type { NotionExportRegistry, SiYuanWritePlan, NotionWritePlanAttachment, NotionWritePlanDocument } from './notion-types.js';
import { normalizeNotionLookup } from './notion-utils.js';

function comparePaths(a: string, b: string) {
	return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export function buildSiYuanWritePlan(registry: NotionExportRegistry): SiYuanWritePlan {
	const { resolverInfo, htmlEntriesByID } = registry;

	const documents = Object.entries(resolverInfo.idsToFileInfo)
		.map(([notionID, fileInfo]) => {
			if (!fileInfo.parentIds.length) {
				fileInfo.parentIds = resolveFallbackParentIDsFromResolver(resolverInfo, fileInfo.path);
			}
			return {
				notionID,
				depth: fileInfo.parentIds.length,
				entry: htmlEntriesByID[notionID],
				fileInfo,
			};
		})
		.filter((doc): doc is NotionWritePlanDocument => Boolean(doc.entry))
		.sort((left, right) => {
			if (left.depth !== right.depth) {
				return left.depth - right.depth;
			}
			return comparePaths(left.fileInfo.path, right.fileInfo.path);
		});

	const attachments = Object.entries(resolverInfo.pathsToAttachmentInfo)
		.map(([path, attachmentInfo]) => {
			const entry =
				registry.assetEntriesByPath[normalizeNotionLookup(path)] ||
				registry.assetEntriesByPath[normalizeNotionLookup(attachmentInfo.nameWithExtension)];
			return {
				entry,
				attachmentInfo,
			};
		})
		.filter((item): item is NotionWritePlanAttachment => Boolean(item.entry))
		.sort((left, right) => comparePaths(left.attachmentInfo.path, right.attachmentInfo.path));

	return {
		notebookName: 'Notion',
		registry,
		documents,
		attachments,
	};
}
