/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

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

export const formatToolResult = (toolResult: LLMToolRunResultContent): JSX.Element => {
	const results: LLMMessageContentParts = Array.isArray(toolResult)
		? toolResult
		: [toolResult as LLMMessageContentPart];
	return (
		<div className='tool-result'>
			{results.map((result, index) => {
				if (result.type === 'text') {
					return (
						<p key={index}>
							<strong>{result.text}</strong>
						</p>
					);
				} else {
					return <p key={index}>Unknown type: {result.type}</p>;
				}
			})}
		</div>
	);
};
