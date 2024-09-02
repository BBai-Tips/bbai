import type { JSONSchema4 } from 'json-schema';
import Ajv from 'ajv';
import type { JSX } from 'preact';

import type { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from './interactions/conversationInteraction.ts';
import type ProjectEditor from '../editor/projectEditor.ts';
import type { ConversationId } from 'shared/types.ts';

export type LLMToolInputSchema = JSONSchema4;
export type LLMToolRunResultContent = string | LLMMessageContentPart | LLMMessageContentParts;

export interface LLMToolFinalizeResult {
	messageId: string;
}

export interface LLMToolRunResult {
	toolResults: LLMToolRunResultContent;
	toolResponse: string;
	bbaiResponse: string;
	finalize?: (messageId: ConversationId) => void;
}

export type LLMToolFormatterDestination = 'console' | 'browser';
export type LLMToolUseInputFormatter = (toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination) => string;
export type LLMToolRunResultFormatter = (
	toolResult: LLMToolRunResultContent,
	format: LLMToolFormatterDestination,
) => string;

abstract class LLMTool {
	public fileName!: string;

	constructor(
		public name: string,
		public description: string,
	) {}

	abstract get input_schema(): LLMToolInputSchema;

	validateInput(input: unknown): boolean {
		const ajv = new Ajv();
		const validate = ajv.compile(this.input_schema);
		return validate(input) as boolean;
	}

	abstract runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult>;

	finalizeToolUse(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		toolRunResultContent: LLMToolRunResultContent,
		isError: boolean,
	): LLMToolFinalizeResult {
		const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, toolRunResultContent, isError) || '';
		return { messageId };
	}

	abstract formatToolUse(toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination): string | JSX.Element;

	abstract formatToolResult(
		toolResult: LLMToolRunResultContent,
		format: LLMToolFormatterDestination,
	): string | JSX.Element;
}

export default LLMTool;
