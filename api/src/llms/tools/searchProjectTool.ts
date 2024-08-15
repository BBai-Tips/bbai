import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { searchFiles } from '../../utils/fileHandling.utils.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';

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

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { pattern, file_pattern } = toolInput as { pattern: string; file_pattern?: string };

		try {
			const { files, errorMessage } = await searchFiles(projectEditor.projectRoot, pattern, file_pattern);

			const resultMessage = `${
				errorMessage ? `Error: ${errorMessage}\n\n` : ''
			}${files.length} files match the pattern "${pattern}"${
				file_pattern ? ` with file pattern "${file_pattern}"` : ''
			}${files.length > 0 ? `\n<files>\n${files.join('\n')}\n</files>` : ''}`;

			const { messageId, toolResponse } = projectEditor.orchestratorController.toolManager.finalizeToolUse(
				interaction,
				toolUse,
				resultMessage,
				!!errorMessage,
				//projectEditor,
			);

			const bbaiResponse = `BBai found ${files.length} files matching the pattern "${pattern}"${
				file_pattern ? ` with file pattern "${file_pattern}"` : ''
			}$`;
			return { messageId, toolResponse, bbaiResponse };
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
