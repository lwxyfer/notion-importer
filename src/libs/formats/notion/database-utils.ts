export const notionColumnTypeToSiYuanType: Record<string, string> = {
	typesTitle: 'block',
	typesDate: 'date',
	typesCreatedTime: 'date',
	typesLastEditedTime: 'date',
	typesSelect: 'select',
	typesStatus: 'select',
	typesMultipleSelect: 'mSelect',
	typesCheckbox: 'checkbox',
	typesFile: 'mAsset',
	typesNumber: 'number',
	typesUrl: 'url',
	typesEmail: 'email',
	typesPhone: 'phone',
	typesRelation: 'text',
	typesText: 'text',
};

export function mapNotionColumnTypeToSiYuan(columnType: string) {
	return notionColumnTypeToSiYuanType[columnType] || 'text';
}
