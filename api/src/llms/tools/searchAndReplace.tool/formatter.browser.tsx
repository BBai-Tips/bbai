/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { filePath, operations, createIfMissing } = toolInput as {
		filePath: string;
		operations: Array<{ search: string; replace: string; caseSensitive?: boolean; replaceAll?: boolean }>;
		createIfMissing: boolean;
	};
	return (
		<div className='tool-use'>
			<p>
				<strong>File:</strong> {filePath}{' '}
				<strong>(${createIfMissing ? 'Create if missing' : "Don't create new file"})</strong>
			</p>
			<p>
				<strong>Operations:</strong>
			</p>
			<ul>
				{operations.map((op, index) => (
					<div>
						<h4>
							Operation ${index + 1}:{' '}
							<strong>(${op.replaceAll ? 'Replace all' : 'Replace first'})</strong>{' '}
							<strong>(${op.caseSensitive ? 'Case sensitive' : 'Case insensitive'})</strong>
						</h4>
						<p>
							<strong>Search:</strong>
						</p>
						<pre style='color: #DAA520;'>${op.search}</pre>
						<p>
							<strong>Replace:</strong>
						</p>
						<pre style='color: #228B22;'>${op.replace}</pre>
						<p>
							<strong>Replace all:</strong> ${op.replaceAll ?? false}
						</p>
						<p>
							<strong>Case sensitive:</strong> ${op.caseSensitive ?? true}
						</p>
					</div>
				))}
			</ul>
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
