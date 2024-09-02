import type ProjectEditor from '../editor/projectEditor.ts';
import type LLMConversationInteraction from './interactions/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';

import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import LLMToolRequestFiles from './tools/requestFilesTool.ts';
import LLMToolForgetFiles from './tools/forgetFilesTool.ts';
import LLMToolSearchProject from './tools/searchProjectTool.ts';
import LLMToolRunCommand from './tools/runCommandTool.ts';
import LLMToolFetchWebPage from './tools/fetchWebPageTool.ts';
import LLMToolFetchWebScreenshot from './tools/fetchWebScreenshotTool.ts';
import LLMToolApplyPatch from './tools/applyPatchTool.ts';
import LLMToolSearchAndReplace from './tools/searchAndReplaceTool.ts';
import LLMToolRewriteFile from './tools/rewriteFileTool.ts';

import { createError, ErrorType } from '../utils/error.utils.ts';
import type { LLMValidationErrorOptions } from '../errors/error.ts';
//import { getContentFromToolResult } from '../utils/llms.utils.ts';
import { logger } from 'shared/logger.ts';

export type LLMToolManagerToolSetType = 'coding' | 'research' | 'creative';

class LLMToolManager {
	private tools: Map<string, LLMTool> = new Map();
	public toolSet: LLMToolManagerToolSetType = 'coding';

	constructor(toolSet?: LLMToolManagerToolSetType) {
		if (toolSet) {
			this.toolSet = toolSet;
		}
		this.registerDefaultTools();
	}

	private registerDefaultTools(): void {
		this.registerTool(new LLMToolRequestFiles());
		this.registerTool(new LLMToolForgetFiles());
		this.registerTool(new LLMToolSearchProject());
		this.registerTool(new LLMToolRewriteFile());
		this.registerTool(new LLMToolSearchAndReplace());
		this.registerTool(new LLMToolApplyPatch());
		this.registerTool(new LLMToolRunCommand());
		this.registerTool(new LLMToolFetchWebPage());
		this.registerTool(new LLMToolFetchWebScreenshot());
	}

	registerTool(tool: LLMTool): void {
		this.tools.set(tool.name, tool);
	}

	getTool(name: string): LLMTool | undefined {
		return this.tools.get(name);
	}

	getToolFileName(name: string): string | undefined {
		const tool = this.tools.get(name);
		return tool ? tool.fileName : undefined;
	}

	getAllTools(): LLMTool[] {
		return Array.from(this.tools.values());
	}

	async handleToolUse(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<
		{
			messageId: string;
			toolResults: LLMToolRunResultContent;
			toolResponse: string;
			bbaiResponse: string;
			isError: boolean;
		}
	> {
		const tool = this.tools.get(toolUse.toolName);
		if (!tool) {
			logger.warn(`Unknown tool used: ${toolUse.toolName}`);
			throw new Error(`Unknown tool used: ${toolUse.toolName}`);
		}
		try {
			if (!toolUse.toolValidation.validated && !tool.validateInput(toolUse.toolInput)) {
				throw createError(ErrorType.LLMValidation, `Invalid input for ${toolUse.toolName} tool`, {
					name: `tool_use-${toolUse.toolName}`,
					validation_type: 'input_schema',
					validation_error: 'Input does not match the required schema',
				} as LLMValidationErrorOptions);
			} else {
				logger.info(
					`handleToolUse - Tool ${toolUse.toolName} is already validated with results: ${toolUse.toolValidation.results}`,
				);
			}

			const { toolResults, toolResponse, bbaiResponse, finalize } = await tool.runTool(
				interaction,
				toolUse,
				projectEditor,
			);

			const { messageId } = tool.finalizeToolUse(
				interaction,
				toolUse,
				toolResults,
				false,
			);

			if (finalize) {
				finalize(messageId);
			}

			return {
				messageId,
				toolResults,
				toolResponse,
				bbaiResponse,
				isError: false,
			};
		} catch (error) {
			logger.error(`Error executing tool ${toolUse.toolName}: ${error.message}`);
			const { messageId } = tool.finalizeToolUse(
				interaction,
				toolUse,
				error.message,
				true,
			);
			return {
				messageId,
				toolResults: [],
				toolResponse: `Error with ${toolUse.toolName}: ${error.message}`,
				bbaiResponse: 'BBai could not run the tool',
				isError: true,
			};
		}
	}
}

export default LLMToolManager;
