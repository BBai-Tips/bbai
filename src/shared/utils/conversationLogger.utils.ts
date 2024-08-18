import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import { ConversationId, ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import { getBbaiDataDir } from 'shared/dataDir.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
import { logger } from 'shared/logger.ts';
import {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';
import LLMTool, {
	LLMToolInputSchema,
	LLMToolRunResultContent,
	LLMToolRunResultFormatter,
	LLMToolUseInputFormatter,
} from 'api/llms/llmTool.ts';

export type ConversationLoggerEntryType = 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'auxiliary' | 'error'; //text_change

export class ConversationLogger {
	private logFile!: string;

	constructor(
		private startDir: string,
		private conversationId: ConversationId,
		private logEntryHandler: (
			type: ConversationLoggerEntryType,
			timestamp: string,
			content: string,
			conversationStats: ConversationMetrics,
			tokenUsageTurn: TokenUsage,
			tokenUsageStatement: TokenUsage,
			tokenUsageConversation: ConversationTokenUsage,
		) => {},
	) {}

	async init(): Promise<ConversationLogger> {
		const bbaiDataDir = await getBbaiDataDir(this.startDir);
		const conversationLogsDir = join(bbaiDataDir, 'conversations', this.conversationId);
		await ensureDir(conversationLogsDir);
		this.logFile = join(conversationLogsDir, 'conversation.log');
		return this;
	}

	private async appendToLog(content: string) {
		await Deno.writeTextFile(this.logFile, content + '\n', { append: true });
	}

	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private async logEntry(
		type: ConversationLoggerEntryType,
		message: string,
		conversationStats: ConversationMetrics = { statementCount: 0, statementTurnCount: 0, conversationTurnCount: 0 },
		tokenUsageTurn: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		},
		tokenUsageStatement: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		},
		tokenUsageConversation: ConversationTokenUsage = {
			inputTokensTotal: 0,
			outputTokensTotal: 0,
			totalTokensTotal: 0,
		},
	) {
		const timestamp = this.getTimestamp();

		try {
			await this.logEntryHandler(
				type,
				timestamp,
				message,
				conversationStats,
				tokenUsageTurn,
				tokenUsageStatement,
				tokenUsageConversation,
			);
		} catch (error) {
			logger.error('Error in logEntryHandler:', error);
		}

		const entry = LogFormatter.createRawEntryWithSeparator(
			type,
			timestamp,
			message,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);

		try {
			await this.appendToLog(entry);
		} catch (error) {
			logger.error('Error appending to log:', error);
		}
	}

	async logUserMessage(message: string, conversationStats?: ConversationMetrics) {
		await this.logEntry('user', message, conversationStats);
	}

	async logAssistantMessage(
		message: string,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		await this.logEntry(
			'assistant',
			message,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
	}

	async logAuxiliaryMessage(message: string) {
		await this.logEntry(
			'auxiliary',
			message,
		);
	}

	async logToolUse(
		toolName: string,
		toolInput: LLMToolInputSchema,
		toolInputFormatter: LLMToolUseInputFormatter,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		let message: string;
		try {
			message = `Tool: ${toolName}\n\n${toolInputFormatter(toolInput, 'console')}`;
		} catch (error) {
			logger.error(`Error formatting tool use for ${toolName}:`, error);
			message = `Tool: ${toolName}\nInput:\n**Error formatting input**\n${JSON.stringify(error)}`;
		}
		try {
			await this.logEntry(
				'tool_use',
				message,
				conversationStats,
				tokenUsageTurn,
				tokenUsageStatement,
				tokenUsageConversation,
			);
		} catch (error) {
			logger.error('Error in logEntry for logToolUse:', error);
		}
	}

	async logToolResult(
		toolName: string,
		toolResult: LLMToolRunResultContent,
		toolRunResultFormatter: LLMToolRunResultFormatter,
	) {
		let message: string;
		try {
			message = `Tool: ${toolName}\nResult:\n${toolRunResultFormatter(toolResult, 'console')}`;
		} catch (error) {
			logger.error(`Error formatting tool result for ${toolName}:`, error);
			message = `Tool: ${toolName}\nResult:\n**Error formatting result**\n${JSON.stringify(error)}`;
		}
		try {
			await this.logEntry('tool_result', message);
		} catch (error) {
			logger.error('Error in logEntry for logToolResult:', error);
		}
	}

	async logError(error: string) {
		await this.logEntry('error', error);
	}

	//async logTextChange(filePath: string, patch: string) {
	//	const message = `Diff Patch for ${filePath}:\n${patch}`;
	//	await this.logEntry('text_change', message);
	//}
}
