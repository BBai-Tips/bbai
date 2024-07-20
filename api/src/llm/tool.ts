import { JSONSchema4 } from 'json-schema';

export type LLMToolInputSchema = JSONSchema4;

class LLMTool {
	constructor(
		public name: string,
		public description: string,
		public input_schema: LLMToolInputSchema,
	) {}
}

export default LLMTool;
