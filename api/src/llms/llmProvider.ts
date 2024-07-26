import { LLMProvider as LLMProviderEnum } from '../types.ts';
import LLM from './providers/baseLLM.ts';
import AnthropicLLM from './providers/anthropicLLM.ts';
import OpenAILLM from './providers/openAILLM.ts';
import { ProjectEditor } from '../editor/projectEditor.ts';

export class LLMFactory {
	static getProvider(
		projectEditor: ProjectEditor,
		llmProviderName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC,
	): LLM {
		switch (llmProviderName) {
			case LLMProviderEnum.ANTHROPIC:
				return new AnthropicLLM(projectEditor);
			case LLMProviderEnum.OPENAI:
				return new OpenAILLM(projectEditor);
			default:
				throw new Error(`Unsupported LLM provider: ${llmProviderName}`);
		}
	}
}
