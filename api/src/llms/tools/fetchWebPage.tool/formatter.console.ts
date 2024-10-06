import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import { getContentFromToolResult } from '../../../utils/llms.utils.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { url } = toolInput as { url: string };
	return stripIndents`
    ${colors.bold('Fetching web page:')} ${colors.cyan(url)}
  `;
};

export const formatToolResult = (toolResult: LLMToolRunResultContent): string => {
	return `Web page content fetched successfully. Length: ${getContentFromToolResult(toolResult).length} characters.`;
	/*
	const results: LLMMessageContentParts = Array.isArray(toolResult)
		? toolResult
		: [toolResult as LLMMessageContentPart];
	return results.map((result) => {
		if (result.type === 'text') {
			return colors.bold(result.text);
		} else if (result.type === 'html') {
			return `HTML content (length: ${result.html.length} characters)`;
		} else {
			return `Unknown type: ${result.type}`;
		}
	}).join('\n');
 */
};
