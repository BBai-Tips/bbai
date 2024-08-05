import { ConversationLoggerEntryType } from 'shared/conversationLogger.ts';
import { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';

export type ConversationId = string;
export type VectorId = string;

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

export interface ConversationMetrics {
	statementCount: number;
	turnCount: number;
	totalTurnCount: number;
}

export interface ConversationStart {
	conversationId: ConversationId;
	conversationTitle: string;
	statementCount: number;
}

export interface ConversationEntry {
	type: ConversationLoggerEntryType;
	timestamp: string;
	conversationId: ConversationId;
	conversationTitle: string;
	content: string;
	conversationStats: ConversationMetrics;
	tokenUsage: TokenUsage;
}

export interface ConversationResponse {
	conversationId: ConversationId;
	response: LLMProviderMessageResponse;
	messageMeta: LLMProviderMessageMeta;
	conversationTitle: string;
	conversationStats: ConversationMetrics;
	tokenUsage: TokenUsage;
}

export interface VectorEmbedding {
	id: VectorId;
	vector: number[];
	metadata: Record<string, unknown>;
}
