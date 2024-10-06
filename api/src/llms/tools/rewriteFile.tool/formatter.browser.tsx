/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { filePath, content, createIfMissing } = toolInput as {
		filePath: string;
		content: string;
		createIfMissing: boolean;
	};
	const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;
	return (
		<div className='tool-use'>
			<p>
				<strong>Rewriting file:</strong> {filePath}
			</p>
			<p>
				<strong>Create if missing:</strong>{' '}
				<span style='color: #DAA520;'>{createIfMissing ? 'Yes' : 'No'}</span>
			</p>
			<p>
				<strong>New content:</strong>
			</p>
			<pre style='background-color: #f0f0f0; padding: 10px; white-space: pre-wrap;'>{contentPreview}</pre>
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
