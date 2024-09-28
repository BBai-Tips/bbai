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
				contentPattern: {
					type: 'string',
					description: String
						.raw`The search pattern for file contents (grep-compatible regular expression). Ensure to escape special regex characters with backslashes, e.g., "\.", "\?", "\*"`,
				},
				caseSensitive: {
					type: 'boolean',
					description:
						'Whether the `contentPattern` is a case sensitive regex. The default is true, to use case sensitive regex.',
					default: true,
				},
				filePattern: {
					type: 'string',
					description: 'File name pattern to limit the search to specific file types or names',
				},
				dateAfter: {
					type: 'string',
					description: 'Search for files modified after this date (YYYY-MM-DD format)',
				},
				dateBefore: {
					type: 'string',
					description: 'Search for files modified before this date (YYYY-MM-DD format)',
				},
				sizeMin: {
					type: 'number',
					description: 'Minimum file size in bytes',
				},
				sizeMax: {
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
		const { contentPattern, caseSensitive = true, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } =
			toolInput as {
				contentPattern?: string;
				caseSensitive?: boolean;
				filePattern?: string;
				dateAfter?: string;
				dateBefore?: string;
				sizeMin?: number;
				sizeMax?: number;
			};
		// caseSensitive controls the regex flag
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags

		try {
			let files: string[] = [];
			let errorMessage: string | null = null;

			let result;
			if (contentPattern) {
				// searchContent or searchContentInFiles
				result = await searchFilesContent(projectEditor.projectRoot, contentPattern, caseSensitive, {
					filePattern,
					dateAfter,
					dateBefore,
					sizeMin,
					sizeMax,
				});
			} else {
				// searchForFiles (metadata-only search)
				result = await searchFilesMetadata(projectEditor.projectRoot, {
					filePattern,
					dateAfter,
					dateBefore,
					sizeMin,
					sizeMax,
				});
			}
			files = result.files;
			errorMessage = result.errorMessage;

			const searchCriteria = [
				contentPattern && `content pattern "${contentPattern}"`,
				// only include case sensitivity details if content pattern was supplied
				contentPattern && `${caseSensitive ? 'case-sensitive' : 'case-insensitive'}`,
				filePattern && `file pattern "${filePattern}"`,
				dateAfter && `modified after ${dateAfter}`,
				dateBefore && `modified before ${dateBefore}`,
				sizeMin !== undefined && `minimum size ${sizeMin} bytes`,
				sizeMax !== undefined && `maximum size ${sizeMax} bytes`,
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
