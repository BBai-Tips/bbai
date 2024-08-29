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

export class LLMToolForgetFiles extends LLMTool {
	constructor() {
		super(
			'forget_files',
			'Remove and Forget specified files from the chat when you no longer need them, to save on token cost and reduce the context you have to read.',
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
				${colors.bold('Files to forget:')}
				${fileNames.map((file) => colors.red(`- ${file}`)).join('\n')}`;
		} else if (format === 'browser') {
			formattedInput = stripIndents`
				<h3>Files to forget:</h3><ul>${
				fileNames.map((file) => `<li style="color: #FF0000;">${file}</li>`).join('')
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
