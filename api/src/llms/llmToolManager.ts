import { logger } from 'shared/logger.ts';
import LLMTool, { LLMToolFinalizeResult, LLMToolRunResultContent, ToolFormatter } from './llmTool.ts';
import { LLMAnswerToolUse, LLMMessageContentPart } from './llmMessage.ts';
import LLMConversationInteraction from './interactions/conversationInteraction.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import { createError, ErrorType } from '../utils/error.utils.ts';
import { LLMValidationErrorOptions } from '../errors/error.ts';

export type LLMToolManagerToolSetType = 'coding' | 'research' | 'creative';

class LLMToolManager {
  private static instance: LLMToolManager;
  private tools: Map<string, LLMTool> = new Map();
  private toolFormatters: Map<string, ToolFormatter> = new Map();
  public toolSet: LLMToolManagerToolSetType = 'coding';

  private constructor() {
    this.loadTools();
  }

  static getInstance(): LLMToolManager {
    if (!LLMToolManager.instance) {
      LLMToolManager.instance = new LLMToolManager();
    }
    return LLMToolManager.instance;
  }

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

  private registerTool(tool: LLMTool): void {
    this.tools.set(tool.name, tool);
  }

  private registerToolFormatter(toolName: string, formatter: ToolFormatter): void {
    this.toolFormatters.set(toolName, formatter);
  }

  getTool(name: string): LLMTool | undefined {
    return this.tools.get(name);
  }

  getToolFormatter(toolName: string): ToolFormatter | undefined {
    return this.toolFormatters.get(toolName);
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

      const { messageId, toolResponse, bbaiResponse } = await tool.runTool(interaction, toolUse, projectEditor);
      return { messageId, toolResponse, bbaiResponse, isError: false };
    } catch (error) {
      logger.error(`Error executing tool ${toolUse.toolName}:`, error);
      const { messageId, toolResponse } = this.finalizeToolUse(
        interaction,
        toolUse,
        error.message,
        true,
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
  ): LLMToolFinalizeResult {
    const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, toolRunResultContent, isError) || '';
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