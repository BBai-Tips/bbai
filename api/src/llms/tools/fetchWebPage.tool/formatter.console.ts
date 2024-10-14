import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import { getContentFromToolResult } from 'api/utils/llms.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { url } = toolInput as { url: string };
	return stripIndents`
    ${colors.bold('Fetching web page:')} ${colors.cyan(url)}
  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { toolResult, bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const { url } = bbaiResponse.data as { url: string; html: string };
		const content = getContentFromToolResult(toolResult);
		const contentPreview = content.length > 500 ? content.slice(0, 500) + '...' : content;
		return colors.bold(`BBai has fetched web page content from ${url}.\n\n`) + colors.cyan(contentPreview);
	} else {
		logger.error('Unexpected bbaiResponse format:', bbaiResponse);
		return bbaiResponse;
	}
};
