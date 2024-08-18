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
import { searchFiles } from '../../utils/fileHandling.utils.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { getContentFromToolResult } from '../../utils/llms.utils.ts';

export class LLMToolSearchProject extends LLMTool {
	constructor() {
		super(
			'search_project',
			'Search the project for files matching a pattern',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				pattern: {
					type: 'string',
					description: 'The search pattern to use (grep-compatible regular expression)',
				},
				file_pattern: {
					type: 'string',
					description: 'Optional file pattern to limit the search to specific file types',
				},
			},
			required: ['pattern'],
		};
	}

	toolUseInputFormatter: LLMToolUseInputFormatter = (
		toolInput: LLMToolInputSchema,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const { pattern, file_pattern } = toolInput as { pattern: string; file_pattern?: string };
		if (format === 'console') {
			return stripIndents`
				${colors.bold('Search pattern:')} ${colors.yellow(pattern)}${
				file_pattern
					? `
				${colors.bold('File pattern:')} ${colors.cyan(file_pattern)}`
					: ''
			}
			`;
		} else if (format === 'browser') {
			return stripIndents`
				<p><strong>Search pattern:</strong> <span style="color: #DAA520;">${pattern}</span></p>
				${
				file_pattern
					? `<p><strong>File pattern:</strong> <span style="color: #4169E1;">${file_pattern}</span></p>`
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
		const { pattern, file_pattern } = toolInput as { pattern: string; file_pattern?: string };

		try {
			const { files, errorMessage } = await searchFiles(projectEditor.projectRoot, pattern, file_pattern);

			const toolResults = stripIndents`
				${
				errorMessage
					? `Error: ${errorMessage}
				
				`
					: ''
			}${files.length} files match the pattern "${pattern}"${
				file_pattern ? ` with file pattern "${file_pattern}"` : ''
			}${
				files.length > 0
					? `
				<files>
				${files.join('\n')}
				</files>`
					: ''
			}
			`;
			const toolResponse = stripIndents`
				Found ${files.length} files matching the pattern "${pattern}"${
				file_pattern ? ` with file pattern "${file_pattern}"` : ''
			}`;
			const bbaiResponse = stripIndents`
				BBai found ${files.length} files matching the pattern "${pattern}"${
				file_pattern ? ` with file pattern "${file_pattern}"` : ''
			}`;

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
