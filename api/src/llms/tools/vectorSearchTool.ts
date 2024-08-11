import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { searchEmbeddings } from '../../utils/embedding.utils.ts';
import { VectorSearchErrorOptions } from '../../errors/error.ts';

export class LLMToolVectorSearch extends LLMTool {
	constructor() {
		super(
			'vector_search',
			'Perform a vector search on the project files',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The search query to use for vector search',
				},
			},
			required: ['query'],
		};
	}

	async runTool(
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;

		const { query } = toolInput as { query: string };
		try {
			const vectorSearchResults = await searchEmbeddings(query);

			const { messageId, toolResponse } = projectEditor.toolManager.finalizeToolUse(
				toolUse,
				vectorSearchResults,
				false,
				projectEditor,
			);

			const bbaiResponse =
				`BBai has completed vector search for query: "${query}". ${vectorSearchResults.length} results found.\n${vectorSearchResults}`;
			return { messageId, toolResponse, bbaiResponse };
		} catch (error) {
			logger.error(`Error performing vector search: ${error.message}`);
			throw createError(ErrorType.VectorSearch, `Error performing vector search: ${error.message}`, {
				name: 'vector-search',
				query,
				operation: 'search',
			} as VectorSearchErrorOptions);
		}
	}
}
