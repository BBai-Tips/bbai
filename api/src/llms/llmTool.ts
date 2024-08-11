import { JSONSchema4 } from 'json-schema';
import Ajv from 'ajv';

import ProjectEditor from '../editor/projectEditor.ts';
import { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

export type LLMToolInputSchema = JSONSchema4;
export type LLMToolRunResultContent = string | LLMMessageContentPart | LLMMessageContentParts;

export interface LLMToolFinalizeResult {
	messageId: string;
	toolResponse: string;
}
export interface LLMToolRunResult {
	messageId: string;
	toolResponse: string;
	bbaiResponse: string;
}

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
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult>;
}

export default LLMTool;
