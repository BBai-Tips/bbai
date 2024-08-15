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

	totalProviderRequests: number;

	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;

	conversationStats: ConversationMetrics;

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
	providerRequestCount?: number;
}

export interface ConversationStart {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	tokenUsageStatement?: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;
	conversationStats: ConversationMetrics; // for resuming a conversation
}

export interface ConversationEntry {
	conversationId: ConversationId;
	conversationTitle: string;
	type: ConversationLoggerEntryType;
	timestamp: string;
	content: string;
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;
	conversationStats: ConversationMetrics;
}

export interface ConversationResponse {
	conversationId: ConversationId;
	response: LLMProviderMessageResponse;
	messageMeta: LLMProviderMessageMeta;
	conversationTitle: string;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;
	conversationStats: ConversationMetrics;
}

export interface VectorEmbedding {
	id: VectorId;
	vector: number[];
	metadata: Record<string, unknown>;
}
