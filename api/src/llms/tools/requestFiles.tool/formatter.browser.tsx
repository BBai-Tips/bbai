/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { fileNames } = toolInput as { fileNames: string[] };
	return (
		<div className='tool-use'>
			<p>
				<strong>Requesting files:</strong>
			</p>
			<ul>
				{fileNames.map((fileName, index) => <li key={index}>{fileName}</li>)}
			</ul>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const data = bbaiResponse.data as { filesAdded: string[]; filesError: string[] };
		return (
			<div className='tool-result'>
				{data.filesAdded.length > 0
					? (
						<div>
							<p>
								<strong>✅ BBai has added these files to the conversation:</strong>
							</p>
							<p>
								<ul>{data.filesAdded.map((file) => <li>{file}</li>)}</ul>
							</p>
						</div>
					)
					: ''}
				{data.filesError.length > 0
					? (
						<div>
							<p>
								<strong>⚠️ BBai failed to add these files to the conversation:</strong>
							</p>
							<p>
								<ul>{data.filesError.map((file) => <li>{file}</li>)}</ul>
							</p>
						</div>
					)
					: ''}
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
