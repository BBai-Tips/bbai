import { JSONSchema4 } from 'json-schema';
import Ajv from 'ajv';

import { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import LLMConversationInteraction from './interactions/conversationInteraction.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import { getContentFromToolResult } from '../utils/llms.utils.ts';
import { logger } from 'shared/logger.ts';
import { ConversationId } from 'shared/types.ts';

export type LLMToolInputSchema = JSONSchema4;
export type LLMToolRunResultContent = string | LLMMessageContentPart | LLMMessageContentParts;

export interface LLMToolFinalizeResult {
	messageId: string;
	//toolResults: LLMToolRunResultContent;
}
export interface LLMToolRunResult {
	//messageId: string;
	toolResults: LLMToolRunResultContent;
	toolResponse: string;
	bbaiResponse: string;
	finalize?: (messageId: ConversationId) => void;
	//finalize?: (interaction: LLMConversationInteraction, messageId: ConversationId) => void;
}

export type LLMToolFormatterDestination = 'console' | 'browser';
export type LLMToolUseInputFormatter = (toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination) => string;
export type LLMToolRunResultFormatter = (
	toolResult: LLMToolRunResultContent,
	format: LLMToolFormatterDestination,
) => string;

abstract class LLMTool {
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
		//logger.debug(`finalizeToolUse - calling addMessageForToolResult for ${toolUse.toolName}`);
		const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, toolRunResultContent, isError) ||
			'';
		return { messageId };
	}

	toolUseInputFormatter(toolInput: LLMToolInputSchema, _format: LLMToolFormatterDestination = 'console'): string {
		return JSON.stringify(toolInput, null, 2);
	}
	toolRunResultFormatter(
		toolResult: LLMToolRunResultContent,
		_format: LLMToolFormatterDestination = 'console',
	): string {
		logger.info('running toolRunResultFormatter', toolResult);
		return getContentFromToolResult(toolResult);
	}
}

export default LLMTool;
