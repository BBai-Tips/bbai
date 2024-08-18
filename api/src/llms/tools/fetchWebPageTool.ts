import LLMTool, {
	LLMToolFormatterDestination,
	LLMToolInputSchema,
	LLMToolRunResult,
	LLMToolRunResultContent,
	LLMToolRunResultFormatter,
	LLMToolUseInputFormatter,
} from 'api/llms/llmTool.ts';
//import { colors } from 'cliffy/ansi/colors.ts';
//import { stripIndents } from 'common-tags';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import FetchManager from 'shared/fetchManager.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
//import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { getContentFromToolResult } from '../../utils/llms.utils.ts';

export class LLMToolFetchWebPage extends LLMTool {
	constructor() {
		super(
			'fetch_web_page',
			'Fetches the content of a specified web page',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'The URL of the web page to fetch' },
			},
			required: ['url'],
		};
	}

	toolUseInputFormatter: LLMToolUseInputFormatter = (
		toolInput: LLMToolInputSchema,
		_format: LLMToolFormatterDestination = 'console',
	): string => {
		return `Fetching web page: ${toolInput.url}`;
	};

	toolRunResultFormatter: LLMToolRunResultFormatter = (
		toolResult: LLMToolRunResultContent,
		_format: LLMToolFormatterDestination = 'console',
	): string => {
		return `Web page content fetched successfully. Length: ${
			getContentFromToolResult(toolResult).length
		} characters.`;
	};

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { url } = toolUse.toolInput as { url: string };
		try {
			const fetchManager = await new FetchManager().init();
			const content: string = await fetchManager.fetchPage(url);

			return {
				toolResults: this.extractTextFromHtml(content),
				toolResponse: `Successfully fetched content from ${url}`,
				bbaiResponse:
					`I've retrieved the content from ${url}. The page content is now available for reference.`,
			};
		} catch (error) {
			throw createError(ErrorType.ToolHandling, `Failed to fetch web page: ${error.message}`);
		}
	}

	private extractTextFromHtml(html: string): string {
		// This is a simple extraction method. In the future, we can implement more sophisticated parsing.
		return html.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
}
