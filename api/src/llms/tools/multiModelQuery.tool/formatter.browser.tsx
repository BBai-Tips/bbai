/** @jsxImportSource preact */
import { Fragment, JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
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

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbaiResponse } = resultContent;
	if (typeof bbaiResponse === 'object' && 'data' in bbaiResponse) {
		const data = bbaiResponse.data as {
			querySuccess: Array<{ modelIdentifier: string; answer: string }>;
			queryError: Array<{ modelIdentifier: string; error: string }>;
		};
		return (
			<div className='tool-result'>
				{data.querySuccess.length > 0
					? (
						<div>
							<p>
								<strong>✅ BBai has queried models:</strong>
							</p>
							<p>
								<ul>
									{data.querySuccess.map((query, index) => (
										<Fragment key={index}>
											{index > 0 && <hr />}
											<li>
												<p>
													<strong>Model:</strong> {query.modelIdentifier}
												</p>
												<div>{query.answer}</div>
											</li>
										</Fragment>
									))}
								</ul>
							</p>
						</div>
					)
					: ''}
				{data.queryError.length > 0
					? (
						<div>
							<p>
								<strong>⚠️ BBai failed to query models:</strong>
							</p>
							<p>
								<ul>
									{data.queryError.map((query, index) => (
										<Fragment key={index}>
											{index > 0 && <hr />}
											<li>
												<p>
													<strong>Model:</strong> {query.modelIdentifier}
												</p>
												<div>{query.error}</div>
											</li>
										</Fragment>
									))}
								</ul>
							</p>
						</div>
					)
					: ''}
			</div>
		);
	} else {
		logger.error('Unexpected bbaiResponse format:', bbaiResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbaiResponse}</strong>
				</p>
			</div>
		);
	}
};
