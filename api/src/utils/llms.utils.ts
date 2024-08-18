import LLMTool, { LLMToolFinalizeResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import { LLMMessageContentPart } from 'api/llms/llmMessage.ts';

export const getContentFromToolResult = (toolRunResultContent: LLMToolRunResultContent): string => {
	if (Array.isArray(toolRunResultContent)) {
		return toolRunResultContent.map((part) => getTextContent(part)).join('\n');
	} else if (typeof toolRunResultContent !== 'string') {
		return getTextContent(toolRunResultContent);
	} else {
		return toolRunResultContent;
	}
};

export const getTextContent = (content: LLMMessageContentPart): string => {
	if ('text' in content) {
		return content.text;
	} else if ('image' in content) {
		return '[Image content]';
	} else if ('tool_use_id' in content) {
		return `[Tool result: ${content.tool_use_id}]`;
	}
	return '[Unknown content]';
};
