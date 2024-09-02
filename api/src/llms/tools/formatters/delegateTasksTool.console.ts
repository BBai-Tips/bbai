import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { tasks } = toolInput as { tasks: string[] };
	return stripIndents`
    ${colors.bold('Tasks to delegate:')}
    ${tasks.map((task, index) => `${index + 1}. ${colors.cyan(task)}`).join('\n')}
  `;
};

export const formatToolResult = (toolResult: LLMToolRunResultContent): string => {
	const results: LLMMessageContentParts = Array.isArray(toolResult)
		? toolResult
		: [toolResult as LLMMessageContentPart];
	return results.map((result) => {
		if (result.type === 'text') {
			return colors.bold(result.text);
		} else {
			return `Unknown type: ${result.type}`;
		}
	}).join('\n');
};
