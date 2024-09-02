import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { fileNames } = toolInput as { fileNames: string[] };
	return stripIndents`
    ${colors.bold('Requesting files:')}
    ${fileNames.map((fileName) => colors.cyan(fileName)).join('\n')}
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
