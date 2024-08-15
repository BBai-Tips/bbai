import LLMTool, { ToolFormatter } from '../llmTool.ts';
import { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from '../llmMessage.ts';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import ProjectEditor from '../../editor/projectEditor.ts';

class RequestFilesToolFormatter implements ToolFormatter {
  formatToolUse(toolName: string, input: object): string {
    const { fileNames } = input as { fileNames: string[] };
    return `Tool: ${toolName}\nRequested files: ${fileNames.join(', ')}`;
  }

  formatToolResult(toolName: string, result: string | LLMMessageContentPart | LLMMessageContentParts): string {
    if (typeof result === 'string') {
      return `Tool: ${toolName}\nResult: ${result}`;
    } else if (Array.isArray(result)) {
      return `Tool: ${toolName}\nResult: ${result.map(part => 'text' in part ? part.text : JSON.stringify(part)).join('\n')}`;
    } else {
      return `Tool: ${toolName}\nResult: ${'text' in result ? result.text : JSON.stringify(result)}`;
    }
  }
}

export class LLMToolRequestFiles extends LLMTool {
  static formatter = new RequestFilesToolFormatter();

  name = 'request_files';
  description = 'Request files to be added to the chat';
  parameters = {
    fileNames: {
      type: 'array',
      items: { type: 'string' },
      description: 'Array of file names to be added to the chat',
    },
  };

  validateInput(input: unknown): boolean {
    if (typeof input !== 'object' || input === null) {
      return false;
    }
    const { fileNames } = input as { fileNames: unknown };
    return Array.isArray(fileNames) && fileNames.every((fileName) => typeof fileName === 'string');
  }

  async runTool(
    interaction: LLMConversationInteraction,
    toolUse: LLMAnswerToolUse,
    projectEditor: ProjectEditor,
  ): Promise<{ messageId: string; toolResponse: string; bbaiResponse: string }> {
    const { fileNames } = toolUse.toolInput as { fileNames: string[] };
    const result = await projectEditor.addFilesToConversation(fileNames);
    const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, result) || '';
    return {
      messageId,
      toolResponse: result,
      bbaiResponse: `Files added to the conversation: ${fileNames.join(', ')}`,
    };
  }
}