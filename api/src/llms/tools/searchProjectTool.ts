import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatters/searchProjectTool.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatters/searchProjectTool.console.ts';
import type LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from '../../editor/projectEditor.ts';
import { searchFilesContent, searchFilesMetadata } from '../../utils/fileHandling.utils.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { stripIndents } from 'common-tags';

export default class LLMToolSearchProject extends LLMTool {
	constructor() {
		super(
			'search_project',
			'Search the project for files matching content, name, date, or size criteria',
		);
		this.fileName = 'searchProjectTool.ts';
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				content_pattern: {
					type: 'string',
					description: String
						.raw`The search pattern for file contents (grep-compatible regular expression). Ensure to escape special regex characters with backslashes, e.g., "\.", "\?", "\*"`,
				},
				file_pattern: {
					type: 'string',
					description: 'File name pattern to limit the search to specific file types or names',
				},
				date_after: {
					type: 'string',
					description: 'Search for files modified after this date (YYYY-MM-DD format)',
				},
				date_before: {
					type: 'string',
					description: 'Search for files modified before this date (YYYY-MM-DD format)',
				},
				size_min: {
					type: 'number',
					description: 'Minimum file size in bytes',
				},
				size_max: {
					type: 'number',
					description: 'Maximum file size in bytes',
				},
			},
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(toolResult: LLMToolRunResultContent, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(toolResult) : formatToolResultBrowser(toolResult);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { content_pattern, file_pattern, date_after, date_before, size_min, size_max } = toolInput as {
			content_pattern?: string;
			file_pattern?: string;
			date_after?: string;
			date_before?: string;
			size_min?: number;
			size_max?: number;
		};

		try {
			let files: string[] = [];
			let errorMessage: string | null = null;

			let result;
			if (content_pattern) {
				// searchContent or searchContentInFiles
				result = await searchFilesContent(projectEditor.projectRoot, content_pattern, {
					file_pattern,
					date_after,
					date_before,
					size_min,
					size_max,
				});
			} else {
				// searchForFiles (metadata-only search)
				result = await searchFilesMetadata(projectEditor.projectRoot, {
					file_pattern,
					date_after,
					date_before,
					size_min,
					size_max,
				});
			}
			files = result.files;
			errorMessage = result.errorMessage;

			const searchCriteria = [
				content_pattern && `content pattern "${content_pattern}"`,
				file_pattern && `file pattern "${file_pattern}"`,
				date_after && `modified after ${date_after}`,
				date_before && `modified before ${date_before}`,
				size_min !== undefined && `minimum size ${size_min} bytes`,
				size_max !== undefined && `maximum size ${size_max} bytes`,
			].filter(Boolean).join(', ');

			const toolResults = stripIndents`
				${
				errorMessage
					? `Error: ${errorMessage}
				
				`
					: ''
			}${files.length} files match the search criteria: ${searchCriteria}${
				files.length > 0
					? `
				<files>
				${files.join('\n')}
				</files>`
					: ''
			}
			`;
			const toolResponse = `Found ${files.length} files matching the search criteria: ${searchCriteria}`;
			const bbaiResponse = `BBai found ${files.length} files matching the search criteria: ${searchCriteria}`;

			return { toolResults, toolResponse, bbaiResponse };
		} catch (error) {
			logger.error(`Error searching project: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error searching project: ${error.message}`, {
				name: 'search-project',
				filePath: projectEditor.projectRoot,
				operation: 'search-project',
			});
		}
	}
}
