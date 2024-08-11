import { ConversationLoggerEntryType } from 'shared/conversationLogger.ts';
import { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';

export type ConversationId = string;

export type VectorId = string;

export interface ConversationMetadata {
	id: ConversationId;
	title: string;
	llmProviderName: string;
	model: string;
	createdAt: string;
	updatedAt: string;
}

export interface ConversationDetailedMetadata extends ConversationMetadata {
	system: string;
	temperature: number;
	maxTokens: number;

	projectInfoType: string;
	projectInfoTier?: number;
	projectInfoContent?: string;

	conversationStats: ConversationMetrics;
	tokenUsage: ConversationTokenUsage;

	tools?: Array<{ name: string; description: string }>;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

export interface ConversationTokenUsage {
	inputTokensTotal: number;
	outputTokensTotal: number;
	totalTokensTotal: number;
	//usageHistory?: Array<TokenUsage>
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
	tokenUsageStatement: TokenUsage;
}

export interface ConversationResponse {
	conversationId: ConversationId;
	response: LLMProviderMessageResponse;
	messageMeta: LLMProviderMessageMeta;
	conversationTitle: string;
	conversationStats: ConversationMetrics;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;
}

export interface VectorEmbedding {
	id: VectorId;
	vector: number[];
	metadata: Record<string, unknown>;
}
