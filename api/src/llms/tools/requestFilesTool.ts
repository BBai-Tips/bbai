import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatters/requestFilesTool.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatters/requestFilesTool.console.ts';
import type LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { logger } from 'shared/logger.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';

export default class LLMToolRequestFiles extends LLMTool {
	constructor() {
		super(
			'request_files',
			`Request files for the chat when you need to review them or make changes. Before requesting a file, check that you don't already have it included in an earlier message`,
		);
		this.fileName = 'requestFilesTool.ts';
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

	formatToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(
		toolResult: LLMToolRunResultContent,
		format: 'console' | 'browser',
	): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(toolResult) : formatToolResultBrowser(toolResult);
	}

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
					filesError.push({
						name: fileToAdd.fileName,
						error: fileToAdd.metadata.error,
					});
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

			const toolResponse = (allFilesFailed ? 'No files added\n' : '') +
				toolResponses.join('\n\n');
			const bbaiResponse = bbaiResponses.join('\n\n');

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

			throw createError(
				ErrorType.FileHandling,
				`Error adding files to conversation: ${error.message}`,
				{
					name: 'request-files',
					filePath: projectEditor.projectRoot,
					operation: 'request-files',
				},
			);
		}
	}
}
