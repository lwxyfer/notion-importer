export const notionToSiYuanBgStyle: Record<string, string> = {
	'block-color-gray_background': 'background-color: var(--notion-importer-block-color-gray-bg); color: var(--notion-importer-block-color-gray-fg);',
	'block-color-brown_background': 'background-color: var(--notion-importer-block-color-brown-bg); color: var(--notion-importer-block-color-brown-fg);',
	'block-color-orange_background': 'background-color: var(--notion-importer-block-color-orange-bg); color: var(--notion-importer-block-color-orange-fg);',
	'block-color-yellow_background': 'background-color: var(--notion-importer-block-color-yellow-bg); color: var(--notion-importer-block-color-yellow-fg);',
	'block-color-teal_background': 'background-color: var(--notion-importer-block-color-teal-bg); color: var(--notion-importer-block-color-teal-fg);',
	'block-color-blue_background': 'background-color: var(--notion-importer-block-color-blue-bg); color: var(--notion-importer-block-color-blue-fg);',
	'block-color-purple_background': 'background-color: var(--notion-importer-block-color-purple-bg); color: var(--notion-importer-block-color-purple-fg);',
	'block-color-pink_background': 'background-color: var(--notion-importer-block-color-pink-bg); color: var(--notion-importer-block-color-pink-fg);',
	'block-color-red_background': 'background-color: var(--notion-importer-block-color-red-bg); color: var(--notion-importer-block-color-red-fg);',
};

export function convertColorMarkers(markdown: string): string {
	let output = markdown
		.replace(/SYCOLOR\\_/g, 'SYCOLOR_')
		.replace(/\\_START/g, '_START')
		.replace(/\\_END/g, '_END')
		.replace(/(SYCOLOR_block-color-\w+)\\_background/g, '$1_background');

	const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	for (const [className, style] of Object.entries(notionToSiYuanBgStyle)) {
		const pattern = new RegExp(
			`${escapeRegExp(`SYCOLOR_${className}_START`)}\\n([\\s\\S]*?)\\n${escapeRegExp('SYCOLOR_END')}(?=\\n|$)`,
			'g',
		);
		output = output.replace(pattern, (_, content: string) => {
			const trimmed = content.replace(/^\n+|\n+$/g, '');
			if (!trimmed.trim()) {
				return '';
			}
			return `${trimmed}\n{: style="${style}" }`;
		});
	}

	return output.replace(/\n{3,}/g, '\n\n');
}

export function convertColumnMarkers(markdown: string): string {
	// Marker names are from Notion's perspective (ROW = row of columns, COL = single column)
	// SiYuan uses inverted names ({{{col = horizontal layout, {{{row = vertical content)
	let output = markdown;
	output = output.replace(/SYCOLROWSTART/g, '\n{{{col\n');
	output = output.replace(/SYCOLROWEND/g, '\n}}}\n');
	output = output.replace(/SYCOLCOLSTART/g, '\n{{{row\n');
	output = output.replace(/SYCOLCOLEND/g, '\n}}}\n');
	output = output.replace(/SYFOLDFOLDSTART/g, '\n\nSYFOLDFOLDSTART\n\n');
	output = output.replace(/SYFOLDFOLDEND/g, '\n\nSYFOLDFOLDEND\n\n');
	return output.replace(/\n{3,}/g, '\n\n');
}
