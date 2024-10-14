import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
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

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const data = bbaiResponse.data as { filesMoved: string[]; filesError: string[]; destination: string };
		return [
			`${
				data.filesMoved.length > 0
					? (
						colors.bold('✅ BBai has moved these files to ${data.destination}:\n') +
						data.filesMoved.map((file) => colors.cyan(`- ${file}`)).join('\n')
					)
					: ''
			}`,
			`${
				data.filesError.length > 0
					? (
						colors.bold('⚠️ BBai failed to move these files to ${data.destination}:\n') +
						data.filesError.map((file) => colors.cyan(`- ${file}`)).join('\n')
					)
					: ''
			}
		`,
		].join('\n\n');
	} else {
		logger.error('Unexpected bbaiResponse format:', bbaiResponse);
		return bbaiResponse;
	}
};
