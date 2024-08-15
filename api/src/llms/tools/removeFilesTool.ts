import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { logger } from 'shared/logger.ts';
import { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';

export class LLMToolRemoveFiles extends LLMTool {
	constructor() {
		super(
			'remove_files',
			'Remove specified files from the chat',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				fileNames: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of file names to be removed from the chat',
				},
			},
			required: ['fileNames'],
			description:
				'Remove files from the chat when you no longer need them, to save on token cost and reduce the context you have to read.',
		};
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { fileNames } = toolInput as { fileNames: string[] };

		try {
			const contentParts = [];
			const fileNamesSuccess: string[] = [];
			const fileNamesError: string[] = [];
			let allFilesFailed = true;

			for (const fileName of fileNames) {
				if (interaction.getFile(fileName)) {
					interaction.removeFile(fileName);
					contentParts.push({
						'type': 'text',
						'text': `File removed: ${fileName}`,
					} as LLMMessageContentPartTextBlock);
					fileNamesSuccess.push(fileName);
					allFilesFailed = false;
				} else {
					contentParts.push({
						'type': 'text',
						'text': `Error removing file ${fileName}: File not found in conversation`,
					} as LLMMessageContentPartTextBlock);
					fileNamesError.push(fileName);
				}
			}

			const { messageId, toolResponse } = projectEditor.orchestratorController.toolManager.finalizeToolUse(
				interaction,
				toolUse,
				contentParts,
				allFilesFailed,
				//projectEditor,
			);

			const bbaiResponses = [];
			if (fileNamesSuccess.length > 0) {
				bbaiResponses.push(
					`BBai has removed these files from the conversation: ${fileNamesSuccess.join(', ')}`,
				);
			}
			if (fileNamesError.length > 0) {
				bbaiResponses.push(
					`BBai failed to remove these files from the conversation: ${fileNamesError.join(', ')}`,
				);
			}

			const bbaiResponse = bbaiResponses.join('\n\n');

			return { messageId, toolResponse, bbaiResponse };
		} catch (error) {
			logger.error(`Error removing files from conversation: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error removing files from conversation: ${error.message}`, {
				name: 'remove-files',
				filePath: projectEditor.projectRoot,
				operation: 'remove-files',
			});
		}
	}
}
