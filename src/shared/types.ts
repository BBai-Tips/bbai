import type { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntry } from 'api/storage/conversationLogger.ts';

export type {
	ConversationLogEntry,
	ConversationLogEntryContent,
	ConversationLogEntryContentToolResult,
	ConversationLogEntryType,
} from 'api/storage/conversationLogger.ts';

export type ConversationId = string;

export type VectorId = string;

export interface ConversationMetadata {
	//startDir: string;
	conversationStats?: ConversationMetrics;
	tokenUsageConversation?: ConversationTokenUsage;
	id: ConversationId;
	title: string;
	llmProviderName: string;
	model: string;
	createdAt: string;
	updatedAt: string;
}

export interface ConversationDetailedMetadata extends ConversationMetadata {
	//system: string;
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

	//tools?: Array<{ name: string; description: string }>;
}

export interface FileMetadata {
	type: 'text' | 'image';
	mimeType?: LLMMessageContentPartImageBlockSourceMediaType;
	path: string;
	size: number;
	lastModified: Date;
	inSystemPrompt: boolean;
	messageId?: string; // also used as revisionId
	toolUseId?: string;
	lastCommit?: string;
	error?: string | null;
}

export type ConversationFilesMetadata = Record<string, FileMetadata>;
// export interface ConversationFilesMetadata {
// 	files: Map<string, FileMetadata>;
// }

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	cacheCreationInputTokens?: number;
	cacheReadInputTokens?: number;
}

export interface ConversationTokenUsage {
	inputTokensTotal: number;
	outputTokensTotal: number;
	totalTokensTotal: number;
	//usageHistory?: Array<TokenUsage>
}

export interface ConversationMetrics {
	statementCount: number;
	statementTurnCount: number;
	conversationTurnCount: number;
	providerRequestCount?: number;
}

export type ConversationEntry = ConversationStart | ConversationContinue | ConversationResponse;

export interface ConversationStart {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	tokenUsageStatement?: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;
	conversationStats: ConversationMetrics; // for resuming a conversation
	conversationHistory: ConversationEntry[];
	formattedContent?: string;
}

export interface ConversationContinue {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	logEntry: ConversationLogEntry;
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;
	conversationStats: ConversationMetrics;
	formattedContent?: string;
}

export interface ConversationResponse {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	logEntry: ConversationLogEntry;
	tokenUsageTurn?: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: ConversationTokenUsage;
	conversationStats: ConversationMetrics;
	formattedContent?: string;
}

export interface VectorEmbedding {
	id: VectorId;
	vector: number[];
	metadata: Record<string, unknown>;
}
