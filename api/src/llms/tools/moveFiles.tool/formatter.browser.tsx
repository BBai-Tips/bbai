/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { sources, destination, overwrite, createMissingDirectories } = toolInput as {
		sources: string[];
		destination: string;
		createMissingDirectories?: boolean;
		overwrite?: boolean;
	};
	return (
		<div className='tool-use'>
			<p>Moving the following files/directories:</p>
			<ul>
				{sources.map((source: string, index: number) => <li key={index}>{source}</li>)}
			</ul>
			<p>To destination: {destination}</p>
			<p>Overwrite: {overwrite ? 'Yes' : 'No'}</p>
			<p>Create Missing Directories: {createMissingDirectories ? 'Yes' : 'No'}</p>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const data = bbaiResponse.data as { filesMoved: string[]; filesError: string[]; destination: string };
		return (
			<div className='tool-result'>
				{data.filesMoved.length > 0
					? (
						<div>
							<p>
								<strong>✅ BBai has moved these files to ${data.destination}:</strong>
							</p>
							<p>
								<ul>{data.filesMoved.map((file) => <li>{file}</li>)}</ul>
							</p>
						</div>
					)
					: ''}
				{data.filesError.length > 0
					? (
						<div>
							<p>
								<strong>⚠️ BBai failed to move these files to ${data.destination}:</strong>
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
