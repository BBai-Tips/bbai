import { logger } from 'shared/logger.ts';
import LLMTool, {
	LLMToolRunResultContent,
	LLMToolRunResultFormatter,
	LLMToolUseInputFormatter,
} from 'api/llms/llmTool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import LLMConversationInteraction from './interactions/conversationInteraction.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import { LLMToolRequestFiles } from './tools/requestFilesTool.ts';
import { LLMToolForgetFiles } from './tools/forgetFilesTool.ts';
import { LLMToolSearchProject } from './tools/searchProjectTool.ts';
import { LLMToolRunCommand } from './tools/runCommandTool.ts';
import { LLMToolFetchWebPage } from './tools/fetchWebPageTool.ts';
import LLMToolFetchWebScreenshot from './tools/fetchWebScreenshotTool.ts';
import { LLMToolApplyPatch } from './tools/applyPatchTool.ts';
import { LLMToolSearchAndReplace } from './tools/searchAndReplaceTool.ts';
import { LLMToolRewriteFile } from './tools/rewriteFileTool.ts';
//import { LLMToolVectorSearch } from './tools/vectorSearchTool.ts';
import { createError, ErrorType } from '../utils/error.utils.ts';
import { getContentFromToolResult } from '../utils/llms.utils.ts';
import { LLMValidationErrorOptions } from '../errors/error.ts';

export type LLMToolManagerToolSetType = 'coding' | 'research' | 'creative';

class LLMToolManager {
	private tools: Map<string, LLMTool> = new Map();
	public toolSet: LLMToolManagerToolSetType = 'coding';
	//private static instance: LLMToolManager;

	constructor(toolSet?: LLMToolManagerToolSetType) {
		if (toolSet) {
			this.toolSet = toolSet;
		}
		this.registerDefaultTools();
		//this.loadTools();
	}
	//static getInstance(): LLMToolManager {
	//	if (!LLMToolManager.instance) {
	//		LLMToolManager.instance = new LLMToolManager();
	//	}
	//	return LLMToolManager.instance;
	//}

	private registerDefaultTools(): void {
		this.registerTool(new LLMToolRequestFiles());
		this.registerTool(new LLMToolForgetFiles());
		this.registerTool(new LLMToolSearchProject());
		this.registerTool(new LLMToolRewriteFile());
		this.registerTool(new LLMToolSearchAndReplace());
		this.registerTool(new LLMToolApplyPatch()); // Claude isn't good enough yet writing diff patches
		this.registerTool(new LLMToolRunCommand());
		this.registerTool(new LLMToolFetchWebPage());
		this.registerTool(new LLMToolFetchWebScreenshot());
		//this.registerTool(new LLMToolVectorSearch());
	}
	/*
	private async loadTools() {
		const toolsDir = new URL('./tools', import.meta.url);
		for await (const entry of Deno.readDir(toolsDir)) {
			if (entry.isFile && entry.name.endsWith('Tool.ts')) {
				try {
					const module = await import(`./tools/${entry.name}`);
					const ToolClass = Object.values(module)[0] as typeof LLMTool;
					const tool = new ToolClass();
					this.registerTool(tool);

					// Check if there's a formatter for this tool
					if ('formatter' in ToolClass) {
						this.registerToolFormatter(tool.name, (ToolClass as any).formatter);
					}
				} catch (error) {
					logger.error(`Error loading tool ${entry.name}:`, error);
				}
			}
		}
	}
	 */

	registerTool(tool: LLMTool): void {
		this.tools.set(tool.name, tool);
	}

	getTool(name: string): LLMTool | undefined {
		return this.tools.get(name);
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
			toolUseInputFormatter: LLMToolUseInputFormatter;
			toolRunResultFormatter: LLMToolRunResultFormatter;
		}
	> {
		const tool = this.getTool(toolUse.toolName);
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
			//logger.debug(`handleToolUse - calling runTool for ${toolUse.toolName}`);

			// runTool will call finalizeToolUse, which handles addMessageForToolResult
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
				toolUseInputFormatter: tool.toolUseInputFormatter,
				toolRunResultFormatter: tool.toolRunResultFormatter,
			};
		} catch (error) {
			logger.error(`Error executing tool ${toolUse.toolName}: ${error.message}`);
			const { messageId } = tool.finalizeToolUse(
				interaction,
				toolUse,
				error.message,
				true,
				//projectEditor,
			);
			return {
				messageId,
				toolResults: [],
				toolResponse: `Error with ${toolUse.toolName}: ${error.message}`,
				bbaiResponse: 'BBai could not run the tool',
				isError: true,
				toolUseInputFormatter: (input, _format) => JSON.stringify(input, null, 2),
				toolRunResultFormatter: (result, _format) => getContentFromToolResult(result),
			};
		}
	}
}

export default LLMToolManager;
