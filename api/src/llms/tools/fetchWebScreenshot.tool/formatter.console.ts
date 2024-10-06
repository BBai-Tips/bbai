import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import { getContentFromToolResult } from '../../../utils/llms.utils.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { url } = toolInput as { url: string };
	return stripIndents`
    ${colors.bold('Capturing screenshot of web page:')} ${colors.cyan(url)}
  `;
};

export const formatToolResult = (toolResult: LLMToolRunResultContent): string => {
	const content = getContentFromToolResult(toolResult);
	return `Screenshot captured: ${content}`;
	/*
	const results: LLMMessageContentParts = Array.isArray(toolResult)
		? toolResult
		: [toolResult as LLMMessageContentPart];
	return results.map((result) => {
		if (result.type === 'text') {
			return colors.bold(result.text);
		} else if (result.type === 'image') {
			return `Screenshot captured: ${result.url}`;
		} else {
			return `Unknown type: ${result.type}`;
		}
	}).join('\n');
	 */
};
