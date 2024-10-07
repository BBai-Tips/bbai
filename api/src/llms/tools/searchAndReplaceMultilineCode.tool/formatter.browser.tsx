/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	return (
		<div className='tool-use'>
		</div>
	);
};

export const formatToolResult = (toolResult: LLMToolRunResultContent): JSX.Element => {
	return (
		<div className='tool-result'>
		</div>
	);
};
