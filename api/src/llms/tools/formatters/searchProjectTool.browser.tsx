/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { getContentFromToolResult } from '../../../utils/llms.utils.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { content_pattern, file_pattern, date_after, date_before, size_min, size_max } = toolInput as {
		content_pattern?: string;
		file_pattern?: string;
		date_after?: string;
		date_before?: string;
		size_min?: number;
		size_max?: number;
	};
	return (
		<div className='tool-use'>
			<h3>Project Search Parameters:</h3>
			{content_pattern && (
				<p>
					<strong>Content pattern:</strong> <span style='color: #DAA520;'>${content_pattern}</span>
				</p>
			)}
			{file_pattern && (
				<p>
					<strong>File pattern:</strong> <span style='color: #4169E1;'>${file_pattern}</span>
				</p>
			)}
			{date_after && (
				<p>
					<strong>Modified after:</strong> <span style='color: #008000;'>${date_after}</span>
				</p>
			)}
			{date_before && (
				<p>
					<strong>Modified before:</strong> <span style='color: #008000;'>${date_before}</span>
				</p>
			)}
			{size_min && (
				<p>
					<strong>Minimum size:</strong> <span style='color: #FF00FF;'>${size_min.toString()} bytes</span>
				</p>
			)}
			{size_max && (
				<p>
					<strong>Maximum size:</strong> <span style='color: #FF00FF;'>${size_max.toString()} bytes</span>
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
