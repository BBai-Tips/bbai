import { LLMProvider as LLMProviderEnum } from '../types.ts';
import LLM from './providers/baseLLM.ts';
import AnthropicLLM from './providers/anthropicLLM.ts';
import OpenAILLM from './providers/openAILLM.ts';

export class LLMFactory {
	static getProvider(projectRoot: string, providerName?: string): LLM {
		const defaultProvider = 'claude';
		const provider = providerName?.toLowerCase() || defaultProvider;

		switch (provider) {
			case 'claude':
				return new AnthropicLLM(projectRoot);
			case 'openai':
				return new OpenAILLM(projectRoot);
			default:
				throw new Error(`Unsupported LLM provider: ${providerName}`);
		}
	}
}
