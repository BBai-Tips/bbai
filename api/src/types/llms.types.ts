import LLMConversation from '../llms/conversation.ts';

import LLMTool from '../llms/tool.ts';
export type { LLMToolInputSchema } from '../llms/tool.ts';

import LLMMessage from '../llms/message.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from '../llms/message.ts';
export type { LLMMessageContentPart, LLMMessageContentParts } from '../llms/message.ts';


export type ConversationId = string;

export enum AnthropicModel {
	CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
	CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
	CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20240620',
	CLAUDE_3_OPUS = 'claude-3-opus-20240229',
}
export const AnthropicModels = [
	AnthropicModel.CLAUDE_3_HAIKU,
	AnthropicModel.CLAUDE_3_SONNET,
	AnthropicModel.CLAUDE_3_5_SONNET,
	AnthropicModel.CLAUDE_3_OPUS,
];

export enum OpenAIModel {
	GPT_4o = 'gpt-4o',
	GPT_4_TURBO = 'gpt-4-turbo',
	GPT_4 = 'gpt-4',
	GPT_35_TURBO = 'gpt-3.5-turbo',
}
export const OpenAIModels = [
	OpenAIModel.GPT_4o,
	OpenAIModel.GPT_4_TURBO,
	OpenAIModel.GPT_4,
	OpenAIModel.GPT_35_TURBO,
];

export enum GroqModel {
	GROQ_LLAMA3_8B = 'llama3-8b-8192',
	GROQ_LLAMA3_70B = 'llama3-70b-8192',
	GROQ_MIXTRAL_8X7B = 'mixtral-8x7b-32768',
	GROQ_GEMMA_7B = 'gemma-7b-it',
}
export const GroqModels = [
	GroqModel.GROQ_LLAMA3_8B,
	GroqModel.GROQ_LLAMA3_70B,
	GroqModel.GROQ_MIXTRAL_8X7B,
	GroqModel.GROQ_GEMMA_7B,
];

export enum LLMProvider {
	ANTHROPIC = 'anthropic',
	OPENAI = 'openai',
	GROQ = 'groq',
	UNKNOWN = '',
}

export const LLMProviders = [
	LLMProvider.ANTHROPIC,
	LLMProvider.OPENAI,
	LLMProvider.GROQ,
	LLMProvider.UNKNOWN,
];

export const LLMProviderLabel = {
	[LLMProvider.ANTHROPIC]: 'Anthropic',
	[LLMProvider.OPENAI]: 'OpenAI',
	[LLMProvider.GROQ]: 'Groq',
	[LLMProvider.UNKNOWN]: 'Unknown',
};

export const LLMModelsByProvider = {
	[LLMProvider.ANTHROPIC]: AnthropicModels,
	[LLMProvider.OPENAI]: OpenAIModels,
	[LLMProvider.GROQ]: GroqModels,
	[LLMProvider.UNKNOWN]: [],
};

export const LLMModelToProvider = Object.fromEntries(
	LLMProviders
		.filter((provider) => provider !== LLMProvider.UNKNOWN)
		.flatMap((provider) => {
			const modelsArray = LLMModelsByProvider[provider];
			return modelsArray ? modelsArray.map((model) => [model, provider]) : [];
		}),
);

/*
export const LLMProviderModels = Object.fromEntries(
	LLMProviders
		.filter((provider) => provider !== LLMProvider.UNKNOWN)
		.flatMap((provider) => {
			const providerLabel = LLMProviderLabel[provider];
            const modelsArray = (globalThis as any)[`${providerLabel}Models`];
			return modelsArray ? modelsArray.map((model:string) => [model, provider]) : [];
		}),
);
 */

export interface LLMTokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}
export interface LLMRateLimit {
	requestsRemaining: number;
	requestsLimit: number;
	//requestsResetMs: number;
	requestsResetDate: Date;
	tokensRemaining: number;
	tokensLimit: number;
	//tokensResetMs: number;
	tokensResetDate: Date;
}
export interface LLMMessageStop {
	stopReason:
		// anthropic stop reasons
		| 'tool_use'
		| 'stop_sequence'
		| 'end_turn'
		| 'max_tokens'
		// openai stop reasons
		| 'stop'
		| 'length'
		| 'tool_calls'
		| 'content_filter'
		| 'function_call'
		| null;
	stopSequence: string | null;
}

export interface LLMProviderMessageResponseMeta {
	status: number;
	statusText: string;
}

export interface LLMProviderMessageRequest {
	id?: string;
	messages: LLMMessage[];
	tools?: LLMTool[];
	system: string;
	prompt: string;
	model: string;
	maxTokens?: number;
	max_tokens?: number; // artefact of formatting request for LLM provider - gets removed in conversation
	temperature?: number;
}

export type LLMProviderMessageResponseType = 'message' | 'error';
export type LLMProviderMessageResponseRole = 'assistant' | 'user';

export interface LLMProviderMessageResponse {
	id: string;
	type: LLMProviderMessageResponseType;
	role: LLMProviderMessageResponseRole;
	model: string; //LLMModel; (AnthropicModel)
	messageStop: LLMMessageStop;
	usage: LLMTokenUsage;
	rateLimit: LLMRateLimit;
	providerMessageResponseMeta: LLMProviderMessageResponseMeta;
	answerContent: LLMMessageContentParts;
	fromCache: boolean;
	answer?: string;
	isTool: boolean;
	toolsUsed?: Array<LLMAnswerToolUse>;
	toolThinking?: string;
	extra?: object;
	createdAt?: Date;
	updatedAt?: Date;
}

export type LLMValidateResponseCallback = (
	llmProviderMessageResponse: LLMProviderMessageResponse,
	conversation: LLMConversation,
) => string | null;

export interface LLMSpeakWithOptions {
	messages?: LLMMessage[];
	tools?: LLMTool[];
	system?: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	validateResponseCallback?: LLMValidateResponseCallback;
}
