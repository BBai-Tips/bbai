import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { command, args = [] } = toolInput as { command: string; args?: string[] };
	return stripIndents`
		${colors.bold('Command:')} ${colors.green(command)}${
		args.length > 0
			? `
		${colors.bold('Arguments:')} ${colors.cyan(args.join(' '))}`
			: ''
	}`;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const { code, command, stderrContainsError, stdout, stderr } = bbaiResponse.data as {
			code: number;
			command: string;
			stderrContainsError: boolean;
			stdout: string;
			stderr: string;
		};

		return `
${colors.bold('BBai ran command:')} ${colors.green(command)}${
			stderrContainsError ? ' (with potential issues in stderr)' : ''
		}
${colors.bold('Exit code:')} ${code}
${stdout ? `\n${colors.bold.cyan('Command output:')}\n${stdout}` : ''}
${stderr ? `\n${colors.bold.red('Error output:')}\n${stderr}` : ''}`;
	} else {
		logger.error('Unexpected bbaiResponse format:', bbaiResponse);
		return bbaiResponse;
	}
};
