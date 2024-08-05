import { logger } from 'shared/logger.ts';
import LLMTool from './llmTool.ts';
import { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import { LLMToolRequestFiles } from './tools/requestFilesTool.ts';
import { LLMToolSearchProject } from './tools/searchProjectTool.ts';
//import { LLMToolApplyPatch } from './tools/applyPatchTool.ts';
import { LLMToolSearchAndReplace } from './tools/searchAndReplaceTool.ts';
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
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<{ messageId: string; feedback: string; isError: boolean }> {
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
			const { messageId, feedback } = await tool.runTool(toolUse, projectEditor);
			return { messageId, feedback, isError: false };
		} catch (error) {
			logger.error(`Error executing tool ${toolUse.toolName}: ${error.message}`);
			const { messageId, feedback } = this.finalizeToolUse(
				toolUse,
				error.message,
				true,
				projectEditor,
			);
			return { messageId, feedback: `Error with ${toolUse.toolName}: ${feedback}`, isError: true };
		}
	}

	finalizeToolUse(
		toolUse: LLMAnswerToolUse,
		toolResult: string | LLMMessageContentPart | LLMMessageContentParts,
		isError: boolean,
		projectEditor: ProjectEditor,
	): { messageId: string; feedback: string } {
		//logger.debug(`finalizeToolUse - calling addMessageForToolResult for ${toolUse.toolName}`);
		const messageId = projectEditor.conversation?.addMessageForToolResult(toolUse.toolUseId, toolResult, isError) ||
			'';
		const feedback = isError
			? `Tool ${toolUse.toolName} failed to run: ${
				Array.isArray(toolResult)
					? this.getTextContent(toolResult[0])
					: typeof toolResult !== 'string'
					? this.getTextContent(toolResult)
					: toolResult
			}`
			: `Tool ${toolUse.toolName} executed successfully: ${
				Array.isArray(toolResult)
					? this.getTextContent(toolResult[0])
					: typeof toolResult !== 'string'
					? this.getTextContent(toolResult)
					: toolResult
			}`;

		return { messageId, feedback };
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
