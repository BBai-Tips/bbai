/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { getContentFromToolResult } from '../../../utils/llms.utils.ts';

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

export const formatToolResult = (toolResult: LLMToolRunResultContent): JSX.Element => {
	const content = getContentFromToolResult(toolResult);
	return (
		<img
			src={content}
			alt='Web page screenshot'
			style='max-width: 100%; height: auto;'
		/>
	);
	/*
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
				} else if (result.type === 'image') {
					return (
						<img
							key={index}
							src={result.url}
							alt='Web page screenshot'
							style='max-width: 100%; height: auto;'
						/>
					);
				} else {
					return <p key={index}>Unknown type: {result.type}</p>;
				}
			})}
		</div>
	);
 */
};
