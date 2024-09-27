import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatters/fetchWebScreenshotTool.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatters/fetchWebScreenshotTool.console.ts';
import type LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartImageBlock, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import FetchManager from 'shared/fetchManager.ts';
import type ProjectEditor from '../../editor/projectEditor.ts';
import { encodeBase64 } from '@std/encoding';
import { createError, ErrorType } from '../../utils/error.utils.ts';

export default class LLMToolFetchWebScreenshot extends LLMTool {
	constructor() {
		super(
			'fetch_web_screenshot',
			'Fetches a screenshot of a specified web page',
		);
		this.fileName = 'fetchWebScreenshotTool.ts';
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'The URL of the web page to capture' },
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
			const screenshotUint8Array: Uint8Array = await fetchManager.fetchScreenshot(url);
			//Deno.writeFileSync('screenshot.png', screenshotUint8Array);
			const screenshotBase64 = encodeBase64(screenshotUint8Array);

			const toolResultContentPart: LLMMessageContentParts = [{
				'type': 'image',
				'source': {
					'type': 'base64',
					'media_type': 'image/png',
					'data': screenshotBase64,
				},
			} as LLMMessageContentPartImageBlock];

			return {
				toolResults: toolResultContentPart,
				toolResponse: `Successfully fetched screenshot from ${url}`,
				bbaiResponse:
					`I've captured a screenshot of ${url}. The image data is available as a base64-encoded string.`,
			};
		} catch (error) {
			throw createError(ErrorType.ToolHandling, `Failed to fetch web page screenshot: ${error.message}`);
		}
	}
}
