import { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from './llmMessage.ts';
import LLMConversationInteraction from './interactions/conversationInteraction.ts';
import ProjectEditor from '../editor/projectEditor.ts';

export type LLMToolRunResultContent = string | LLMMessageContentPart | LLMMessageContentParts;

export interface LLMToolFinalizeResult {
  messageId: string;
  toolResponse: string;
}

export interface ToolFormatter {
  formatToolUse(toolName: string, input: object): string;
  formatToolResult(toolName: string, result: LLMToolRunResultContent): string;
}

abstract class LLMTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, unknown>;

  abstract validateInput(input: unknown): boolean;

  abstract runTool(
    interaction: LLMConversationInteraction,
    toolUse: LLMAnswerToolUse,
    projectEditor: ProjectEditor,
  ): Promise<{ messageId: string; toolResponse: string; bbaiResponse: string }>;
}

export default LLMTool;