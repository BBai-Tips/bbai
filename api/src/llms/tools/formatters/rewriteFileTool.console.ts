import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { filePath, content, createIfMissing } = toolInput as {
		filePath: string;
		content: string;
		createIfMissing: boolean;
	};
	const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;
	return stripIndents`
		${colors.bold('Rewriting file:')} ${colors.cyan(filePath)}
		${colors.bold('Create if missing:')} ${createIfMissing ? colors.green('Yes') : colors.red('No')}
		${colors.bold('New content:')}
		${colors.gray(contentPreview)}
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
