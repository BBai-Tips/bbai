import { LLMCallbackType, LLMProvider as LLMProviderEnum } from '../types.ts';
import type { LLMCallbacks } from '../types.ts';
import LLM from './providers/baseLLM.ts';
import AnthropicLLM from './providers/anthropicLLM.ts';
//import OpenAILLM from './providers/openAILLM.ts';
import { ProjectEditor } from '../editor/projectEditor.ts';

type LLMCallbackTypeKey = typeof LLMCallbackType[keyof typeof LLMCallbackType];

export class LLMFactory {
	static getProvider(
		projectEditor: ProjectEditor,
		llmProviderName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC,
	): LLM {
		const callbacks: LLMCallbacks = {
			PROJECT_ROOT: () => projectEditor.projectRoot,
			PROJECT_INFO: () => projectEditor.projectInfo,
			PROJECT_FILE_CONTENT: async (filePath: string) => await projectEditor.readProjectFileContent(filePath),
		};

		switch (llmProviderName) {
			case LLMProviderEnum.ANTHROPIC:
				return new AnthropicLLM(callbacks);
			// case LLMProviderEnum.OPENAI:
			// 	return new OpenAILLM(callbacks);
			default:
				throw new Error(`Unsupported LLM provider: ${llmProviderName}`);
		}
	}
}
