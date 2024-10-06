/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { tasks } = toolInput as { tasks: string[] };
	return (
		<div className='tool-use'>
			<p>
				<strong>Tasks to delegate:</strong>
			</p>
			<ul>
				{tasks.map((task, index) => <li key={index}>{task}</li>)}
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
