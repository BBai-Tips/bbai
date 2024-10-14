import { logger } from 'shared/logger.ts';

export function createFileChangeXmlString(filePath: string, changeContent: string): string | null {
	try {
		return `<file path="${filePath}">\n${changeContent}\n</file>`;
	} catch (error) {
		logger.error(`Error creating XML string for ${filePath}: ${error.message}`);
		return null;
	}
}
