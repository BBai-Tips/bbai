import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { sources, destination, overwrite, createMissingDirectories } = toolInput as {
		sources: string[];
		destination: string;
		overwrite?: boolean;
		createMissingDirectories?: boolean;
	};
	return stripIndents`
    ${colors.bold('Moving files/directories:')}
    ${sources.map((source) => colors.cyan(source)).join('\n')}
    To destination: ${colors.cyan(destination)}
    Overwrite: ${overwrite ? colors.green('Yes') : colors.red('No')}
    Create Missing Directories: ${createMissingDirectories ? colors.green('Yes') : colors.red('No')}
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
