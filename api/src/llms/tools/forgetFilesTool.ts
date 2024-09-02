import { JSX } from 'preact';
import LLMTool, { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatters/forgetFilesTool.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatters/forgetFilesTool.console.ts';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { logger } from 'shared/logger.ts';
import { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';

export default class LLMToolForgetFiles extends LLMTool {
	constructor() {
		super(
			'forget_files',
			'Remove and Forget specified files from the chat when you no longer need them, to save on token cost and reduce the context you have to read.',
		);
		const url = new URL(import.meta.url);
		this.fileName = url.pathname.split('/').pop() || '';
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
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(toolResult: LLMToolRunResultContent, format: 'console' | 'browser'): string | JSX.Element {
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
			const toolResultContentParts = [];
			const filesSuccess: Array<{ name: string }> = [];
			const filesError: Array<{ name: string; error: string }> = [];
			let allFilesFailed = true;

			for (const fileName of fileNames) {
				if (interaction.getFile(fileName)) {
					interaction.removeFile(fileName);
					toolResultContentParts.push({
						'type': 'text',
						'text': `File removed: ${fileName}`,
					} as LLMMessageContentPartTextBlock);
					filesSuccess.push({ name: fileName });
					allFilesFailed = false;
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error removing file ${fileName}: File is not in the conversation history`,
					} as LLMMessageContentPartTextBlock);
					filesError.push({ name: fileName, error: 'File is not in the conversation history' });
				}
			}

			const bbaiResponses = [];
			const toolResponses = [];
			if (filesSuccess.length > 0) {
				bbaiResponses.push(
					`BBai has removed these files from the conversation: ${filesSuccess.map((f) => f.name).join(', ')}`,
				);
				toolResponses.push(
					`Removed files from the conversation:\n${filesSuccess.map((f) => `- ${f.name}`).join('\n')}`,
				);
			}
			if (filesError.length > 0) {
				bbaiResponses.push(
					`BBai failed to remove these files from the conversation:\n${
						filesError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
					}`,
				);
				toolResponses.push(
					`Failed to remove files from the conversation:\n${
						filesError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
					}`,
				);
			}

			const toolResults = toolResultContentParts;
			const toolResponse = (allFilesFailed ? 'No files removed\n' : '') + toolResponses.join('\n\n');
			const bbaiResponse = bbaiResponses.join('\n\n');

			return { toolResults, toolResponse, bbaiResponse };
		} catch (error) {
			logger.error(`Error removing files from conversation: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error removing files from conversation: ${error.message}`, {
				name: 'forget-files',
				filePath: projectEditor.projectRoot,
				operation: 'forget-files',
			});
		}
	}
}
