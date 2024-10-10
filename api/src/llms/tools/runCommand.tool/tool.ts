import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolConfig, LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

interface LLMToolRunCommandConfig extends LLMToolConfig {
	allowedCommands?: string[];
}

export default class LLMToolRunCommand extends LLMTool {
	private allowedCommands: Array<string>;

	constructor(name: string, description: string, toolConfig: LLMToolRunCommandConfig) {
		super(
			name,
			description,
			toolConfig,
		);

		this.allowedCommands = toolConfig.allowedCommands || [];
		//logger.debug(`LLMToolRunCommand: allowedCommands`, this.allowedCommands);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				command: {
					type: 'string',
					enum: this.allowedCommands,
					description: 'The command to run',
				},
				args: {
					type: 'array',
					items: {
						type: 'string',
					},
					description: 'Arguments for the command',
				},
			},
			required: ['command'],
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(toolResult: LLMToolRunResultContent, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(toolResult) : formatToolResultBrowser(toolResult);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { command, args = [] } = toolInput as {
			command: string;
			args?: string[];
		};

		if (!this.allowedCommands.some((allowed) => command.startsWith(allowed))) {
			const toolResults = `Command not allowed: ${command}`;

			const bbaiResponse = `BBai won't run unapproved commands: ${command}`;
			const toolResponse = toolResults;
			return { toolResults, toolResponse, bbaiResponse };
		} else {
			logger.info(`Running command: ${command} ${args.join(' ')}`);

			try {
				const [denoCommand, ...denoArgs] = command.split(' ');
				const process = new Deno.Command(denoCommand, {
					args: [...denoArgs, ...args],
					cwd: projectEditor.projectRoot,
					stdout: 'piped',
					stderr: 'piped',
				});

				const { code, stdout, stderr } = await process.output();

				const output = new TextDecoder().decode(stdout);
				const errorOutput = new TextDecoder().decode(stderr);

				const isError = code !== 0;
				const stderrContainsError = this.checkStderrForErrors(errorOutput, command);

				const toolResults = `Command executed with exit code: ${code}\n\nOutput:\n${output}${
					errorOutput ? `\n\nError output:\n${errorOutput}` : ''
				}`;
				const toolResponse = isError ? 'Command exited with non-zero status' : 'Command completed successfully';
				const bbaiResponse = `BBai ran command: ${command}${
					stderrContainsError ? ' (with potential issues in stderr)' : ''
				}`;

				return { toolResults, toolResponse, bbaiResponse };
			} catch (error) {
				const errorMessage = `Failed to execute command: ${error.message}`;
				logger.error(errorMessage);

				throw createError(ErrorType.CommandExecution, errorMessage, {
					name: 'command-execution-error',
					command,
					args,
				});
			}
		}
	}

	private checkStderrForErrors(stderr: string, command: string): boolean {
		// List of strings that indicate an actual error in stderr
		const errorIndicators = ['error:', 'exception:', 'failed:'];

		// Check if any error indicators are present in stderr
		const containsError = errorIndicators.some((indicator) => stderr.toLowerCase().includes(indicator));

		// For Deno commands, presence of output in stderr doesn't always indicate an error
		if (command.startsWith('deno') && !containsError) {
			return false;
		}

		// For other commands, any output to stderr is considered an error
		return stderr.trim() !== '';
	}
}
