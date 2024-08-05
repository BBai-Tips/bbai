import { logger } from 'shared/logger.ts';
import LLMTool, { LLMToolInputSchema } from '../llmTool.ts';
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
		};
	}

	async runTool(
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<{ messageId: string; feedback: string }> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { fileNames } = toolInput as { fileNames: string[] };

		try {
			const filesAdded = await projectEditor.prepareFilesForConversation(fileNames);

			const contentParts = [];
			let allFilesFailed = true;
			for (const fileToAdd of filesAdded) {
				if (fileToAdd.metadata.error) {
					contentParts.push({
						'type': 'text',
						'text': `Error adding file ${fileToAdd.fileName}`,
						//'text': `Error adding file ${fileToAdd.fileName}: ${fileToAdd.metadata.error}`,
					} as LLMMessageContentPartTextBlock);
				} else {
					contentParts.push({
						'type': 'text',
						'text': `File added: ${fileToAdd.fileName}`,
					} as LLMMessageContentPartTextBlock);
					allFilesFailed = false;
				}
			}

			// [TODO] we're creating a bit of a circle by calling back into the toolManager in the projectEditor
			// Since we're not holding onto a copy of toolManager, it should be fine - dangerous territory though
			const { messageId, feedback } = projectEditor.toolManager.finalizeToolUse(
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
			const filesSummary = filesAdded.map((file) =>
				//`${file.fileName} (${file.metadata.error ? 'Error' : 'Success'})`
				`${file.fileName} (${file.metadata.error ? 'Error' : 'Success'})`
			).join(', ');

			// const storageLocation = this.determineStorageLocation(fullFilePath, content, source);
			// if (storageLocation === 'system') {
			// 	this.conversation.addFileForSystemPrompt(fileName, metadata, messageId, toolUse.toolUseId);
			// } else {
			// 	this.conversation.addFileForMessage(fileName, metadata, messageId, toolUse.toolUseId);
			// }

			return { messageId, feedback: `${feedback}\nBBai has added files to the conversation: ${filesSummary}` };
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
