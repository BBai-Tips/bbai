/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { contentPattern, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } = toolInput as {
		contentPattern?: string;
		filePattern?: string;
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
	};
	return (
		<div className='tool-use'>
			<h3>Project Search Parameters:</h3>
			{contentPattern && (
				<p>
					<strong>Content pattern:</strong> <span style='color: #DAA520;'>${contentPattern}</span>
				</p>
			)}
			{filePattern && (
				<p>
					<strong>File pattern:</strong> <span style='color: #4169E1;'>${filePattern}</span>
				</p>
			)}
			{dateAfter && (
				<p>
					<strong>Modified after:</strong> <span style='color: #008000;'>${dateAfter}</span>
				</p>
			)}
			{dateBefore && (
				<p>
					<strong>Modified before:</strong> <span style='color: #008000;'>${dateBefore}</span>
				</p>
			)}
			{sizeMin && (
				<p>
					<strong>Minimum size:</strong> <span style='color: #FF00FF;'>${sizeMin.toString()} bytes</span>
				</p>
			)}
			{sizeMax && (
				<p>
					<strong>Maximum size:</strong> <span style='color: #FF00FF;'>${sizeMax.toString()} bytes</span>
				</p>
			)}
		</div>
	);
};

export const formatToolResult = (toolResult: LLMToolRunResultContent): JSX.Element => {
	const lines = getContentFromToolResult(toolResult).split('\n');
	const resultSummary = lines[0];
	const fileList = lines.slice(2, -1).join('\n');
	return (
		<div className='tool-result'>
			<p>
				<strong>${resultSummary}</strong>
			</p>
			<p>
				<strong>Matching files:</strong>
			</p>
			<pre style='background-color: #F0F8FF; padding: 10px;'>${fileList}</pre>
		</div>
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
				} else {
					return <p key={index}>Unknown type: {result.type}</p>;
				}
			})}
		</div>
	);
 */
};
