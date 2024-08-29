import LLMTool, {
	LLMToolFormatterDestination,
	LLMToolInputSchema,
	LLMToolRunResult,
	LLMToolRunResultContent,
	LLMToolRunResultFormatter,
	LLMToolUseInputFormatter,
} from 'api/llms/llmTool.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { searchFilesContent, searchFilesMetadata } from '../../utils/fileHandling.utils.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { getContentFromToolResult } from '../../utils/llms.utils.ts';

export class LLMToolSearchProject extends LLMTool {
	constructor() {
		super(
			'search_project',
			'Search the project for files matching content, name, date, or size criteria',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				content_pattern: {
					type: 'string',
					description: 'The search pattern for file contents (grep-compatible regular expression)',
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

	toolUseInputFormatter: LLMToolUseInputFormatter = (
		toolInput: LLMToolInputSchema,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const { content_pattern, file_pattern, date_after, date_before, size_min, size_max } = toolInput as {
			content_pattern?: string;
			file_pattern?: string;
			date_after?: string;
			date_before?: string;
			size_min?: number;
			size_max?: number;
		};

		if (format === 'console') {
			return stripIndents`
				${content_pattern ? `${colors.bold('Content pattern:')} ${colors.yellow(content_pattern)}` : ''}
				${file_pattern ? `${colors.bold('File pattern:')} ${colors.cyan(file_pattern)}` : ''}
				${date_after ? `${colors.bold('Modified after:')} ${colors.green(date_after)}` : ''}
				${date_before ? `${colors.bold('Modified before:')} ${colors.green(date_before)}` : ''}
				${
				size_min !== undefined
					? `${colors.bold('Minimum size:')} ${colors.magenta(size_min.toString())} bytes`
					: ''
			}
				${
				size_max !== undefined
					? `${colors.bold('Maximum size:')} ${colors.magenta(size_max.toString())} bytes`
					: ''
			}
			`;
		} else if (format === 'browser') {
			return stripIndents`
				${
				content_pattern
					? `<p><strong>Content pattern:</strong> <span style="color: #DAA520;">${content_pattern}</span></p>`
					: ''
			}
				${
				file_pattern
					? `<p><strong>File pattern:</strong> <span style="color: #4169E1;">${file_pattern}</span></p>`
					: ''
			}
				${
				date_after
					? `<p><strong>Modified after:</strong> <span style="color: #008000;">${date_after}</span></p>`
					: ''
			}
				${
				date_before
					? `<p><strong>Modified before:</strong> <span style="color: #008000;">${date_before}</span></p>`
					: ''
			}
				${
				size_min !== undefined
					? `<p><strong>Minimum size:</strong> <span style="color: #FF00FF;">${size_min.toString()} bytes</span></p>`
					: ''
			}
				${
				size_max !== undefined
					? `<p><strong>Maximum size:</strong> <span style="color: #FF00FF;">${size_max.toString()} bytes</span></p>`
					: ''
			}
			`;
		}
		return JSON.stringify(toolInput, null, 2);
	};

	toolRunResultFormatter: LLMToolRunResultFormatter = (
		toolResult: LLMToolRunResultContent,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const lines = getContentFromToolResult(toolResult).split('\n');
		const resultSummary = lines[0];
		const fileList = lines.slice(2, -1).join('\n');

		if (format === 'console') {
			return stripIndents`
				${colors.bold(resultSummary)}
				
				${colors.cyan('Matching files:')}
				${fileList}
			`;
		} else if (format === 'browser') {
			return stripIndents`
				<p><strong>${resultSummary}</strong></p>
				<p><strong>Matching files:</strong></p>
				<pre style="background-color: #F0F8FF; padding: 10px;">${fileList}</pre>`;
		}
		return getContentFromToolResult(toolResult);
	};

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
