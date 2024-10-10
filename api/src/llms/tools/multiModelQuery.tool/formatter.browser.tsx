/** @jsxImportSource preact */
import { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { query, models } = toolInput as { query: string; models: string[] };
	//logger.info('LLMToolMultiModelQuery: formatToolUse', { query, models });
	return (
		<div className='tool-use'>
			<p>
				<strong>Querying multiple models:</strong>
			</p>
			<p>Query: {query}</p>
			<p>Models: {models.join(', ')}</p>
		</div>
	);
};

export const formatToolResult = (toolResult: LLMToolRunResultContent): JSX.Element => {
	const results: LLMMessageContentParts = Array.isArray(toolResult)
		? toolResult
		: [toolResult as LLMMessageContentPart];
	//logger.info('LLMToolMultiModelQuery: formatToolResult', { results });
	return (
		<div className='tool-result'>
			<p>
				<strong>Model Responses:</strong>
			</p>

			{results.map((result, index) => {
				if (result.type === 'text') {
					return (
						<p key={index}>
							{result.text}
						</p>
					);
				} else {
					return <p key={index}>Unknown type: {result.type}</p>;
				}
			})}
		</div>
	);
};
