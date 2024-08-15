import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { logger } from 'shared/logger.ts';

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

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { command, args = [] } = toolInput as {
			command: string;
			args?: string[];
		};

		if (!LLMToolRunCommand.ALLOWED_COMMANDS.some((allowed) => command.startsWith(allowed))) {
			const toolResponse = `Command not allowed: ${command}`;
			const { messageId } = projectEditor.orchestratorController.toolManager.finalizeToolUse(
				interaction,
				toolUse,
				toolResponse,
				true,
				//projectEditor,
			);

			const bbaiResponse = `BBai won't run unapproved commands: ${command}`;
			return { messageId, toolResponse, bbaiResponse };
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

				let toolResponse = `Command executed with exit code: ${code}\n\nOutput:\n${output}`;

				if (errorOutput) {
					toolResponse += `\n\nError output:\n${errorOutput}`;
				}
				// [Needs testing] should errorOutput cause tool.isError, or just non-zero code
				// what about return codes like grep which have non-zero values that are not "errors"
				// we'll remain cautious say it's an error
				const isError = code !== 0 || errorOutput !== '';

				const { messageId } = projectEditor.orchestratorController.toolManager.finalizeToolUse(
					interaction,
					toolUse,
					toolResponse,
					isError,
					//projectEditor,
				);

				const bbaiResponse = `BBai ran command: ${command}`;
				return { messageId, toolResponse, bbaiResponse };
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
