import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
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

export default class LLMToolRunCommand extends LLMTool {
	private static readonly ALLOWED_COMMANDS = [
		'deno task tool:check-types-project',
		'deno task tool:check-types-args',
		'deno task tool:test',
		'deno task tool:format',
	];

	constructor() {
		super(
			'run_command',
			'Run a system command and return the output',
		);
		const url = new URL(import.meta.url);
		this.fileName = url.pathname.split('/').pop() || '';
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				command: {
					type: 'string',
					enum: LLMToolRunCommand.ALLOWED_COMMANDS,
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

		if (!LLMToolRunCommand.ALLOWED_COMMANDS.some((allowed) => command.startsWith(allowed))) {
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

				const isError = code !== 0 || errorOutput !== '';

				const toolResults = `Command executed with exit code: ${code}\n\nOutput:\n${output}${
					errorOutput ? `\n\nError output:\n${errorOutput}` : ''
				}`;
				const toolResponse = isError ? 'Command ran with errors' : 'Command ran successfully';
				const bbaiResponse = `BBai ran command: ${command}`;

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
}
