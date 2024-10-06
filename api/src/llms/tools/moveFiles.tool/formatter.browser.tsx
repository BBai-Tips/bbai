/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

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
