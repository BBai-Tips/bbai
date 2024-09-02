import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (
	toolInput: LLMToolInputSchema,
): string => {
	const { command, args = [] } = toolInput as { command: string; args?: string[] };
	return stripIndents`
		${colors.bold('Command:')} ${colors.yellow(command)}${
		args.length > 0
			? `
		${colors.bold('Arguments:')} ${colors.cyan(args.join(' '))}`
			: ''
	}`;
};

export const formatToolResult = (
	toolResult: LLMToolRunResultContent,
): string => {
	const lines = toolResult.toString().split('\n');
	const exitCodeLine = lines[0];
	const output = lines.slice(2).join('\n');

	return stripIndents`
		${colors.bold(exitCodeLine)}
	
	
		${colors.cyan('Command output:')}
		${output}
	  `;
};
