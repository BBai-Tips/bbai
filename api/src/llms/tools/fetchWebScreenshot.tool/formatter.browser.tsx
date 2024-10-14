/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { url } = toolInput as { url: string };
	return (
		<div className='tool-use'>
			<p>
				<strong>Capturing screenshot of web page:</strong>{' '}
				<a href={url} target='_blank' rel='noopener noreferrer'>{url}</a>
			</p>
		</div>
	);
};

export const getImageContent = (contentParts: LLMMessageContentParts): string => {
	const content = contentParts[0] || { source: { data: '' } };
	if ('source' in content) {
		return content.source.data;
	}
	return '';
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { toolResult, bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const { url } = bbaiResponse.data as { url: string };
		const content = getImageContent(toolResult as LLMMessageContentParts);
		return (
			<div className='tool-result'>
				<p>
					<strong>
						BBai has fetched web page screenshot from {url}.
					</strong>
				</p>
				<img
					src={`data:image/png;base64,${content}`}
					alt='Web page screenshot'
					style={{ maxWidth: '100%', height: 'auto' }}
				/>
			</div>
		);
	} else {
		logger.error('Unexpected bbaiResponse format:', bbaiResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbaiResponse}</strong>
				</p>
			</div>
		);
	}
};
