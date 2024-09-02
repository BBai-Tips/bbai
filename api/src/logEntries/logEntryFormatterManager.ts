//import type { ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import type { LLMToolFormatterDestination, LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { JSX } from 'preact';
import LLMToolManager from '../llms/llmToolManager.ts';
import type { ConversationLogEntry, ConversationLoggerEntryType } from 'shared/conversationLogger.ts';
import { logger } from 'shared/logger.ts';

export default class LogEntryFormatterManager {
	private toolManager: LLMToolManager = new LLMToolManager();

	formatLogEntry(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		options?: any,
	): string | JSX.Element {
		switch (logEntry.entryType as ConversationLoggerEntryType) {
			case 'user':
			case 'assistant':
			case 'auxiliary':
			case 'error':
				return this.formatBasicEntry(destination, logEntry, options);
			case 'tool_use':
			case 'tool_result':
				if (!logEntry.toolName) {
					throw new Error('Tool name is required for tool formatters');
				}
				return this.formatToolEntry(destination, logEntry, options);
			default:
				throw new Error(`Unknown log entry type: ${logEntry.entryType}`);
		}
	}

	private formatToolEntry(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		_options: any,
	): string | JSX.Element {
		if (!logEntry.toolName) throw new Error(`Tool not found: ${logEntry.toolName}`);
		const tool = this.toolManager.getTool(logEntry.toolName);
		if (!tool) {
			throw new Error(`Tool not found: ${logEntry.toolName}`);
		}

		try {
			if (logEntry.entryType === 'tool_use') {
				return tool.formatToolUse(logEntry.content as LLMToolInputSchema, destination);
			} else {
				return tool.formatToolResult(logEntry.content as LLMToolRunResultContent, destination);
			}
		} catch (error) {
			logger.error(`Error formatting ${logEntry.entryType} for tool ${logEntry.toolName}: ${error.message}`);
			return `Error formatting ${logEntry.entryType} for tool ${logEntry.toolName}`;
		}
	}

	private formatBasicEntry(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		options?: unknown,
	): string {
		return destination === 'console'
			? this.formatBasicEntryConsole(logEntry, options)
			: this.formatBasicEntryBrowser(logEntry, options);
	}

	private formatBasicEntryConsole(logEntry: ConversationLogEntry, _options: unknown): string {
		return logEntry.content as string;
		// const { content, metadata } = entry;
		// const formattedMetadata = this.formatMetadataConsole(
		// 	metadata?.conversationStats,
		// 	metadata?.tokenUsageTurn,
		// 	metadata?.tokenUsageStatement,
		// 	metadata?.tokenUsageConversation,
		// );
		// return `${formattedContent}\n${formattedMetadata}`;
	}

	private formatBasicEntryBrowser(logEntry: ConversationLogEntry, _options: unknown): string {
		return `<div class="${logEntry.entryType}-message">${logEntry.content}</div>`;
		// const { content, metadata } = entry;
		// const formattedMetadata = this.formatMetadataBrowser(
		// 	metadata?.conversationStats,
		// 	metadata?.tokenUsageTurn,
		// 	metadata?.tokenUsageStatement,
		// 	metadata?.tokenUsageConversation,
		// );
		// return `${formattedContent}${formattedMetadata}`;
	}

	/*
	private formatMetadataConsole(
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		return JSON.stringify(
			{ conversationStats, tokenUsageTurn, tokenUsageStatement, tokenUsageConversation },
			null,
			2,
		);
	}

	private formatMetadataBrowser(
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		const metadata = JSON.stringify(
			{ conversationStats, tokenUsageTurn, tokenUsageStatement, tokenUsageConversation },
			null,
			2,
		);
		return `<div class="metadata">${metadata}</div>`;
	}
	 */
}
