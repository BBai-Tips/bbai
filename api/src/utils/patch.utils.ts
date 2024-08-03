import { logger } from 'shared/logger.ts';

export function createFilePatchXmlString(filePath: string, patchContent: string): string | null {
	try {
		return `<file path="${filePath}">\n${patchContent}\n</file>`;
	} catch (error) {
		logger.error(`Error creating XML string for ${filePath}: ${error.message}`);
		return null;
	}
}
