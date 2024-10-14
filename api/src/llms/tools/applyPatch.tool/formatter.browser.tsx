/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { filePath, patch } = toolInput as { filePath?: string; patch: string };
	return (
		<div className='tool-use'>
			{filePath
				? (
					<p>
						<strong>File to patch:</strong> <span style='color: #4169E1;'>{filePath}</span>
					</p>
				)
				: (
					<p>
						<strong>Multi-file patch</strong>
					</p>
				)}
			<p>
				<strong>Patch:</strong>
			</p>
			<pre style='background-color: #FFFACD; padding: 10px;'>{patch}</pre>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const { modifiedFiles, newFiles } = bbaiResponse.data as { modifiedFiles: string[]; newFiles: string[] };
		return (
			<div>
				<p>
					<strong>
						`✅ Patch applied successfully to ${modifiedFiles.length + newFiles.length} file(s):`
					</strong>
				</p>
				{modifiedFiles.length > 0
					? (
						<p>
							<ul>{modifiedFiles.map((file) => <li>📝 Modified: {file}</li>)}</ul>
						</p>
					)
					: ''}

				{newFiles.length > 0
					? (
						<p>
							<ul>{newFiles.map((file) => <li>📄 Created: {file}</li>)}</ul>
						</p>
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
