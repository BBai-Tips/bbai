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
import { logger } from 'shared/logger.ts';
import { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { getContentFromToolResult } from '../../utils/llms.utils.ts';

export class LLMToolRequestFiles extends LLMTool {
	constructor() {
		super(
			'request_files',
			`Request files for the chat when you need to review them or make changes. Before requesting a file, check that you don't already have it included in an earlier message`,
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

	toolUseInputFormatter: LLMToolUseInputFormatter = (
		toolInput: LLMToolInputSchema,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const { fileNames } = toolInput as { fileNames: string[] };
		let formattedInput = '';
		if (format === 'console') {
			formattedInput = stripIndents`
				${colors.bold('Requested files:')}
				${fileNames.map((file) => colors.cyan(`- ${file}`)).join('\n')}`;
		} else if (format === 'browser') {
			formattedInput = stripIndents`
				<h3>Requested files:</h3><ul>${
				fileNames.map((file) => `<li style="color: #4169E1;">${file}</li>`).join('')
			}</ul>`;
		}
		if (format === 'console') {
			return formattedInput;
		} else {
			return JSON.stringify(toolInput, null, 2);
		}
	};

	toolRunResultFormatter: LLMToolRunResultFormatter = (
		toolResult: LLMToolRunResultContent,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		if (format === 'console') {
			return colors.bold(getContentFromToolResult(toolResult));
		} else if (format === 'browser') {
			return `<p><strong>${getContentFromToolResult(toolResult)}</strong></p>`;
		}
		return getContentFromToolResult(toolResult);
	};

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { fileNames } = toolInput as { fileNames: string[] };

		try {
			const filesAdded = await projectEditor.prepareFilesForConversation(fileNames);

			const toolResultContentParts = [];
			const filesSuccess: Array<{ name: string }> = [];
			const filesError: Array<{ name: string; error: string }> = [];
			let allFilesFailed = true;

			for (const fileToAdd of filesAdded) {
				if (fileToAdd.metadata.error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error adding file ${fileToAdd.fileName}: ${fileToAdd.metadata.error}`,
					} as LLMMessageContentPartTextBlock);
					filesError.push({ name: fileToAdd.fileName, error: fileToAdd.metadata.error });
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `File added: ${fileToAdd.fileName}`,
					} as LLMMessageContentPartTextBlock);
					filesSuccess.push({ name: fileToAdd.fileName });
					allFilesFailed = false;
				}
			}

			const bbaiResponses = [];
			const toolResponses = [];
			if (filesSuccess.length > 0) {
				bbaiResponses.push(
					`BBai has added these files to the conversation: ${filesSuccess.map((f) => f.name).join(', ')}`,
				);
				toolResponses.push(
					`Added files to the conversation:\n${filesSuccess.map((f) => `- ${f.name}`).join('\n')}`,
				);
			}
			if (filesError.length > 0) {
				bbaiResponses.push(
					`BBai failed to add these files to the conversation:\n${
						filesError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
					}`,
				);
				toolResponses.push(
					`Failed to add files to the conversation:\n${
						filesError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
					}`,
				);
			}

			const toolResults = toolResultContentParts;
			const toolResponse = (allFilesFailed ? 'No files added\n' : '') + toolResponses.join('\n\n');
			const bbaiResponse = bbaiResponses.join('\n\n');

			// const storageLocation = this.determineStorageLocation(fullFilePath, content, source);
			// if (storageLocation === 'system') {
			// 	this.conversation.addFileForSystemPrompt(fileName, metadata, messageId, toolUse.toolUseId);
			// } else {
			// 	this.conversation.addFileForMessage(fileName, metadata, messageId, toolUse.toolUseId);
			// }

			return {
				toolResults,
				toolResponse,
				bbaiResponse,
				finalize: (messageId) => {
					interaction.addFilesForMessage(
						filesAdded,
						messageId,
						toolUse.toolUseId,
					);
				},
			};
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
