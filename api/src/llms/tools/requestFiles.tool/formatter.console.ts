import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { fileNames } = toolInput as { fileNames: string[] };
	return stripIndents`
    ${colors.bold('Requesting files:')}
    ${fileNames.map((fileName) => colors.cyan(fileName)).join('\n')}
  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const data = bbaiResponse.data as { filesAdded: string[]; filesError: string[] };
		return [
			`${
				data.filesAdded.length > 0
					? (
						colors.bold('✅ BBai has added these files to the conversation:\n') +
						data.filesAdded.map((file) => colors.cyan(`- ${file}`)).join('\n')
					)
					: ''
			}`,
			`${
				data.filesError.length > 0
					? (
						colors.bold('⚠️ BBai failed to add these files to the conversation:\n') +
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
