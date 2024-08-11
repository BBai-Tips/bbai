import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import { logger } from 'shared/logger.ts';
import { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';

export class LLMToolRequestFiles extends LLMTool {
	constructor() {
		super(
			'request_files',
			'Request files to be added to the chat',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				fileNames: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of file names to be added to the chat',
				},
			},
			required: ['fileNames'],
			description:
				`Request files for the chat when you need to review them or make changes. Before requesting a file, check that you don't already have it included in an earlier message`,
		};
	}

	async runTool(
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { fileNames } = toolInput as { fileNames: string[] };

		try {
			const filesAdded = await projectEditor.prepareFilesForConversation(fileNames);

			const contentParts = [];
			const fileNamesSuccess: string[] = [];
			const fileNamesError: string[] = [];
			let allFilesFailed = true;
			for (const fileToAdd of filesAdded) {
				if (fileToAdd.metadata.error) {
					contentParts.push({
						'type': 'text',
						'text': `Error adding file ${fileToAdd.fileName}: ${fileToAdd.metadata.error}`,
					} as LLMMessageContentPartTextBlock);
					fileNamesError.push(fileToAdd.fileName);
				} else {
					contentParts.push({
						'type': 'text',
						'text': `File added: ${fileToAdd.fileName}`,
					} as LLMMessageContentPartTextBlock);
					fileNamesSuccess.push(fileToAdd.fileName);
					allFilesFailed = false;
				}
			}

			// [TODO] we're creating a bit of a circle by calling back into the toolManager in the projectEditor
			// Since we're not holding onto a copy of toolManager, it should be fine - dangerous territory though
			const { messageId, toolResponse } = projectEditor.toolManager.finalizeToolUse(
				toolUse,
				contentParts,
				allFilesFailed,
				projectEditor,
			);

			projectEditor.conversation?.addFilesForMessage(
				filesAdded,
				messageId,
				toolUse.toolUseId,
			);
			const bbaiResponses = [];
			if (fileNamesSuccess.length > 0) {
				bbaiResponses.push(`BBai has added these files to the conversation: ${fileNamesSuccess.join(', ')}`);
			}
			if (fileNamesError.length > 0) {
				bbaiResponses.push(`BBai failed to add these files to the conversation: ${fileNamesError.join(', ')}`);
			}

			const bbaiResponse = bbaiResponses.join('\n\n');

			// const storageLocation = this.determineStorageLocation(fullFilePath, content, source);
			// if (storageLocation === 'system') {
			// 	this.conversation.addFileForSystemPrompt(fileName, metadata, messageId, toolUse.toolUseId);
			// } else {
			// 	this.conversation.addFileForMessage(fileName, metadata, messageId, toolUse.toolUseId);
			// }

			return { messageId, toolResponse, bbaiResponse };
		} catch (error) {
			logger.error(`Error adding files to conversation: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error adding files to conversation: ${error.message}`, {
				name: 'request-files',
				filePath: projectEditor.projectRoot,
				operation: 'request-files',
			});
		}
	}
}
