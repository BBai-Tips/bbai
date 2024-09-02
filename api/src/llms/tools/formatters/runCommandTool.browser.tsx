/** @jsxImportSource preact */

import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { JSX } from 'preact';

export const formatToolUse = (
	toolInput: LLMToolInputSchema,
): JSX.Element => {
	const { command, args = [] } = toolInput as { command: string; args?: string[] };
	return (
		<div className='tool-use run-command'>
			<h3>Run Command Tool</h3>
			<p>
				<strong>Command:</strong> <span style={{ color: '#DAA520' }}>{command}</span>
			</p>
			{args.length > 0 && (
				<p>
					<strong>Arguments:</strong> <span style={{ color: '#4169E1' }}>{args.join(' ')}</span>
				</p>
			)}
		</div>
	);
};

export const formatToolResult = (
	toolResult: LLMToolRunResultContent,
): JSX.Element => {
	const lines = toolResult.toString().split('\n');
	const exitCodeLine = lines[0];
	const output = lines.slice(2).join('\n');

	return (
		<div className='tool-result run-command'>
			<p>
				<strong>{exitCodeLine}</strong>
			</p>
			<p>
				<strong>Command output:</strong>
			</p>
			<pre style={{ backgroundColor: '#F0F8FF', padding: '10px' }}>{output}</pre>
		</div>
	);
};
