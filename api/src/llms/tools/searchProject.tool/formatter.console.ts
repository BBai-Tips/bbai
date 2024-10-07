import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import { getContentFromToolResult } from 'api/utils/llms.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { contentPattern, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } = toolInput as {
		contentPattern?: string;
		filePattern?: string;
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
	};
	return stripIndents`
    ${colors.bold('Project Search Parameters:')}
    ${contentPattern ? `${colors.cyan('Content pattern:')} ${contentPattern}` : ''}
    ${filePattern ? `${colors.cyan('File pattern:')} ${filePattern}` : ''}
    ${dateAfter ? `${colors.cyan('Modified after:')} ${dateAfter}` : ''}
    ${dateBefore ? `${colors.cyan('Modified before:')} ${dateBefore}` : ''}
    ${sizeMin ? `${colors.cyan('Minimum size:')} ${sizeMin.toString()} bytes` : ''}
    ${sizeMax ? `${colors.cyan('Maximum size:')} ${sizeMax.toString()} bytes` : ''}
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
