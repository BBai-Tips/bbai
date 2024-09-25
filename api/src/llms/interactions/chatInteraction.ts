import LLMInteraction from './baseInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
import { AnthropicModel } from 'api/types.ts';
import type { LLMMessageContentPart, LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { ConversationId } from 'shared/types.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
//import { logger } from 'shared/logger.ts';

class LLMChatInteraction extends LLMInteraction {
	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
	}

	public async prepareSytemPrompt(system: string): Promise<string> {
		//logger.info('ChatInteraction: Preparing system prompt for chat', system);
		return new Promise((resolve) => resolve(system));
	}
	public async prepareMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		return new Promise((resolve) => resolve(messages));
	}
	public async prepareTools(tools: Map<string, LLMTool>): Promise<LLMTool[]> {
		return Array.from(tools.values());
	}

	public async chat(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {
				model: AnthropicModel.CLAUDE_3_HAIKU,
				system: '',
				maxTokens: 4096,
			} as LLMSpeakWithOptions;
		}

		this._statementTurnCount++;
		//logger.debug(`chat - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		this.addMessageForUserRole({ type: 'text', text: prompt });
		this.conversationLogger.logAuxiliaryMessage(prompt);

		const response = await this.llm.speakWithPlus(this, speakOptions);
		const contentPart: LLMMessageContentPart = response.messageResponse
			.answerContent[0] as LLMMessageContentPartTextBlock;
		const msg = contentPart.text;

		this.conversationLogger.logAuxiliaryMessage(msg);

		return response;
	}
}

export default LLMChatInteraction;
