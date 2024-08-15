import { logger } from 'shared/logger.ts';
import LLMTool, { LLMToolFinalizeResult, LLMToolRunResultContent } from './llmTool.ts';
import { LLMAnswerToolUse, LLMMessageContentPart } from 'api/llms/llmMessage.ts';
import LLMConversationInteraction from './interactions/conversationInteraction.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import { LLMToolRequestFiles } from './tools/requestFilesTool.ts';
import { LLMToolSearchProject } from './tools/searchProjectTool.ts';
import { LLMToolRunCommand } from './tools/runCommandTool.ts';
//import { LLMToolApplyPatch } from './tools/applyPatchTool.ts';
import { LLMToolSearchAndReplace } from './tools/searchAndReplaceTool.ts';
import { RewriteFileTool } from './tools/rewriteFileTool.ts';
//import { LLMToolVectorSearch } from './tools/vectorSearchTool.ts';
import { createError, ErrorType } from '../utils/error.utils.ts';
import { LLMValidationErrorOptions } from '../errors/error.ts';

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
		this.registerTool(new LLMToolSearchProject());
		this.registerTool(new LLMToolSearchAndReplace());
		this.registerTool(new LLMToolRunCommand());
		this.registerTool(new RewriteFileTool());
		//this.registerTool(new LLMToolApplyPatch()); // Claude isn't good enough yet writing diff patches
		//this.registerTool(new LLMToolVectorSearch());
	}

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
	): Promise<{ messageId: string; toolResponse: string; bbaiResponse: string; isError: boolean }> {
		try {
			const tool = this.getTool(toolUse.toolName);
			if (!tool) {
				logger.warn(`Unknown tool used: ${toolUse.toolName}`);
				throw new Error(`Unknown tool used: ${toolUse.toolName}`);
			}

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
			const { messageId, toolResponse, bbaiResponse } = await tool.runTool(interaction, toolUse, projectEditor);
			return { messageId, toolResponse, bbaiResponse, isError: false };
		} catch (error) {
			logger.error(`Error executing tool ${toolUse.toolName}: ${error.message}`);
			const { messageId, toolResponse } = this.finalizeToolUse(
				interaction,
				toolUse,
				error.message,
				true,
				//projectEditor,
			);
			return {
				messageId,
				toolResponse: `Error with ${toolUse.toolName}: ${toolResponse}`,
				bbaiResponse: 'BBai could not run the tool',
				isError: true,
			};
		}
	}

	finalizeToolUse(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		toolRunResultContent: LLMToolRunResultContent,
		isError: boolean,
		//projectEditor: ProjectEditor,
	): LLMToolFinalizeResult {
		//logger.debug(`finalizeToolUse - calling addMessageForToolResult for ${toolUse.toolName}`);
		const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, toolRunResultContent, isError) ||
			'';
		const toolResponse = isError
			? `Tool ${toolUse.toolName} failed to run:\n${this.getContentFromToolResult(toolRunResultContent)}`
			: `Tool ${toolUse.toolName} executed successfully:\n${this.getContentFromToolResult(toolRunResultContent)}`;

		return { messageId, toolResponse };
	}

	private getContentFromToolResult(toolRunResultContent: LLMToolRunResultContent): string {
		if (Array.isArray(toolRunResultContent)) {
			return toolRunResultContent.map((part) => this.getTextContent(part)).join('\n');
		} else if (typeof toolRunResultContent !== 'string') {
			return this.getTextContent(toolRunResultContent);
		} else {
			return toolRunResultContent;
		}
	}

	private getTextContent(content: LLMMessageContentPart): string {
		if ('text' in content) {
			return content.text;
		} else if ('image' in content) {
			return '[Image content]';
		} else if ('tool_use_id' in content) {
			return `[Tool result: ${content.tool_use_id}]`;
		}
		return '[Unknown content]';
	}
}

export default LLMToolManager;
