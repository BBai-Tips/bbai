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
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { logger } from 'shared/logger.ts';
import { getContentFromToolResult } from '../../utils/llms.utils.ts';

export class LLMToolRunCommand extends LLMTool {
	private static readonly ALLOWED_COMMANDS = [
		'deno task tool:check-types',
		'deno task tool:test',
		'deno task tool:format',
	];
	constructor() {
		super(
			'run_command',
			'Run a system command and return the output',
		);
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

	toolUseInputFormatter: LLMToolUseInputFormatter = (
		toolInput: LLMToolInputSchema,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const { command, args = [] } = toolInput as { command: string; args?: string[] };
		if (format === 'console') {
			return stripIndents`
				${colors.bold('Command:')} ${colors.yellow(command)}${
				args.length > 0
					? `
				${colors.bold('Arguments:')} ${colors.cyan(args.join(' '))}`
					: ''
			}`;
		} else if (format === 'browser') {
			return stripIndents`
				<p><strong>Command:</strong> 
				  <span style="color: #DAA520;">${command}</span>
				</p>${
				args.length > 0
					? `
				<p><strong>Arguments:</strong> 
				  <span style="color: #4169E1;">${args.join(' ')}</span>
				</p>`
					: ''
			}
			`;
		}
		return JSON.stringify(toolInput, null, 2);
	};

	toolRunResultFormatter: LLMToolRunResultFormatter = (
		toolResult: LLMToolRunResultContent,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const lines = getContentFromToolResult(toolResult).split('\n');
		const exitCodeLine = lines[0];
		const output = lines.slice(2).join('\n');

		if (format === 'console') {
			return stripIndents`
				${colors.bold(exitCodeLine)}\n\n${colors.cyan('Command output:')}
				${output}
			`;
		} else if (format === 'browser') {
			return stripIndents`
				<p><strong>${exitCodeLine}</strong></p>
				<p><strong>Command output:</strong></p>
				<pre style="background-color: #F0F8FF; padding: 10px;">${output}</pre>
			`;
		}
		return getContentFromToolResult(toolResult);
	};

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

				// [Needs testing] should errorOutput cause tool.isError, or just non-zero code
				// what about return codes like grep which have non-zero values that are not "errors"
				// we'll remain cautious say it's an error
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
