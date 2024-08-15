import {
	LLMMessageStop,
	LLMProviderMessageResponseRole,
	LLMProviderMessageResponseType,
	LLMTokenUsage,
} from '../types.ts';

export interface LLMMessageContentPartTextBlock {
	type: 'text';
	text: string;
}

export interface LLMMessageContentPartImageBlock {
	type: 'image';
	source: LLMMessageContentPartImageBlockSource;
}
export interface LLMMessageContentPartImageBlockSource {
	data: string;
	media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
	type: 'base64';
}

export interface LLMMessageContentPartToolUseBlock {
	type: 'tool_use' | 'tool_calls'; // tool_use is anthropic - tool_calls is openai
	id: string;
	input: object;
	name: string;
}

export interface LLMMessageContentPartToolResultBlock {
	type: 'tool_result' | 'tool'; // tool_result is anthropic - tool is openai
	tool_use_id?: string; // anthropic
	tool_call_id?: string; // openai
	content?: Array<LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock>;
	is_error?: boolean;
}

export type LLMMessageContentPartType = 'text' | 'image' | 'tool_use' | 'tool_calls' | 'tool_result' | 'tool';

export type LLMMessageContentPart =
	| LLMMessageContentPartTextBlock
	| LLMMessageContentPartImageBlock
	| LLMMessageContentPartToolUseBlock
	| LLMMessageContentPartToolResultBlock;

export type LLMMessageContentParts = Array<LLMMessageContentPart>;

export interface LLMAnswerToolUse {
	toolThinking?: string;
	toolInput: object;
	toolUseId: string;
	toolName: string;
	toolValidation: { validated: boolean; results: string };
}

export interface LLMMessageProviderResponse {
	id: string;
	type: LLMProviderMessageResponseType;
	role: LLMProviderMessageResponseRole;
	model: string;
	system?: string;
	messageStop: LLMMessageStop;
	usage: LLMTokenUsage;
	isTool: boolean;
	toolsUsed?: Array<LLMAnswerToolUse>;
	toolThinking?: string;
	extra?: object;
	createdAt?: Date;
	updatedAt?: Date;
}

class LLMMessage {
	public timestamp: string = new Date().toISOString();
	constructor(
		public role: 'user' | 'assistant' | 'system' | 'tool', // system and tool are only for openai
		public content: LLMMessageContentParts,
		public tool_call_id?: string,
		public providerResponse?: LLMMessageProviderResponse,
		public id?: string,
	) {
		this.setTimestamp();
	}

	public setTimestamp(): void {
		if (!this.timestamp) {
			this.timestamp = new Date().toISOString();
		}
	}
}

export default LLMMessage;
