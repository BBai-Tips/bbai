import LLMInteraction from './baseInteraction.ts';
import LLM from '../providers/baseLLM.ts';
import {
	AnthropicModel,
	ConversationId,
	LLMMessageContentPart,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from '../../types.ts';
import LLMMessage, { LLMMessageContentPartTextBlock } from '../llmMessage.ts';
import LLMTool from '../llmTool.ts';
import { logger } from 'shared/logger.ts';

class LLMChatInteraction extends LLMInteraction {
	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
	}

	public async prepareSytemPrompt(system: string): Promise<string> {
		return new Promise((resolve) => resolve(system));
	}
	public async prepareMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		return new Promise((resolve) => resolve(messages));
	}
	public async prepareTools(tools: LLMTool[]): Promise<LLMTool[]> {
		return new Promise((resolve) => resolve(tools));
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

		this._turnCount++;
		//logger.debug(`chat - calling addMessageForUserRole for turn ${this._turnCount}` );
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
