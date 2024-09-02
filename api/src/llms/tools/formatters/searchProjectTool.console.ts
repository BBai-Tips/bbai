import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import { getContentFromToolResult } from '../../../utils/llms.utils.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { content_pattern, file_pattern, date_after, date_before, size_min, size_max } = toolInput as {
		content_pattern?: string;
		file_pattern?: string;
		date_after?: string;
		date_before?: string;
		size_min?: number;
		size_max?: number;
	};
	return stripIndents`
    ${colors.bold('Project Search Parameters:')}
    ${content_pattern ? `${colors.cyan('Content pattern:')} ${content_pattern}` : ''}
    ${file_pattern ? `${colors.cyan('File pattern:')} ${file_pattern}` : ''}
    ${date_after ? `${colors.cyan('Modified after:')} ${date_after}` : ''}
    ${date_before ? `${colors.cyan('Modified before:')} ${date_before}` : ''}
    ${size_min ? `${colors.cyan('Minimum size:')} ${size_min.toString()} bytes` : ''}
    ${size_max ? `${colors.cyan('Maximum size:')} ${size_max.toString()} bytes` : ''}
  `.trim();
};

export const formatToolResult = (toolResult: LLMToolRunResultContent): string => {
	const lines = getContentFromToolResult(toolResult).split('\n');
	const resultSummary = lines[0];
	const fileList = lines.slice(2, -1).join('\n');
	return stripIndents`
				${colors.bold(resultSummary)}
				
				${colors.cyan('Matching files:')}
				${fileList}
			`;
	/*
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
 */
};
