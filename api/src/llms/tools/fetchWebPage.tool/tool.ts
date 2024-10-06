import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import FetchManager from 'shared/fetchManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
//import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
//import { getContentFromToolResult } from '../../utils/llms.utils.ts';

export default class LLMToolFetchWebPage extends LLMTool {
	constructor() {
		super(
			'fetch_web_page',
			'Fetches the content of a specified web page',
		);
		this.fileName = 'fetchWebPageTool.ts';
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

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(toolResult: LLMToolRunResultContent, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(toolResult) : formatToolResultBrowser(toolResult);
	}

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
