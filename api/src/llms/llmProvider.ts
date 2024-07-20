import { LLMProvider as LLMProviderEnum } from '../types.ts';
import LLM from './providers/baseLLM.ts';
import AnthropicLLM from './providers/anthropicLLM.ts';
import OpenAILLM from './providers/openAILLM.ts';
import { ProjectEditor } from '../editor/projectEditor.ts';

export class LLMFactory {
	static getProvider(projectEditor: ProjectEditor, providerName?: string): LLM {
		const defaultProvider = 'claude';
		const provider = providerName?.toLowerCase() || defaultProvider;

		switch (provider) {
			case 'claude':
				return new AnthropicLLM(projectEditor);
			case 'openai':
				return new OpenAILLM(projectEditor);
			default:
				throw new Error(`Unsupported LLM provider: ${providerName}`);
		}
	}
}
