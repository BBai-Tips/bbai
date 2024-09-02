import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import type { JSX } from 'preact';
import { renderToString } from 'preact-render-to-string';

import LogEntryFormatterManager from '../../../api/src/logEntries/logEntryFormatterManager.ts';
import ConversationLogFormatter from 'shared/conversationLogFormatter.ts';
import { ConversationId, ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import { getBbaiDataDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';
import LLMTool, { LLMToolFormatterDestination, LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export type ConversationLoggerEntryType = 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'auxiliary' | 'error'; //text_change
export interface ConversationLogEntry {
	entryType: ConversationLoggerEntryType;
	content: string | LLMToolInputSchema | LLMToolRunResultContent;
	toolName?: string;
}

export default class ConversationLogger {
	private logFileRaw!: string;
	private logFileJson!: string;
	private static readonly ENTRY_SEPARATOR = '<<<BBAI_LOG_ENTRY_SEPARATOR>>>';
	private static readonly entryTypeLabels: Record<
		ConversationLoggerEntryType,
		string
	> = {
		user: config.myPersonsName || 'Person',
		assistant: config.myAssistantsName || 'Assistant',
		tool_use: 'Tool Input',
		tool_result: 'Tool Output',
		auxiliary: 'Auxiliary Chat',
		error: 'Error',
	};
	private logEntryFormatterManager = new LogEntryFormatterManager();

	constructor(
		private startDir: string,
		private conversationId: ConversationId,
		private logEntryHandler: (
			timestamp: string,
			logEntry: ConversationLogEntry,
			conversationStats: ConversationMetrics,
			tokenUsageTurn: TokenUsage,
			tokenUsageStatement: TokenUsage,
			tokenUsageConversation: ConversationTokenUsage,
		) => {},
	) {}

	async init(): Promise<ConversationLogger> {
		this.logFileRaw = await ConversationLogger.getLogFileRawPath(this.startDir, this.conversationId);
		this.logFileJson = await ConversationLogger.getLogFileJsonPath(this.startDir, this.conversationId);
		return this;
	}

	static async getLogFileDirPath(startDir: string, conversationId: string): Promise<string> {
		const bbaiDataDir = await getBbaiDataDir(startDir);
		const conversationLogsDir = join(bbaiDataDir, 'conversations', conversationId);
		await ensureDir(conversationLogsDir);
		return conversationLogsDir;
	}
	static async getLogFileRawPath(startDir: string, conversationId: string): Promise<string> {
		const conversationLogsDir = await ConversationLogger.getLogFileDirPath(startDir, conversationId);
		return join(conversationLogsDir, 'conversation.log');
	}
	static async getLogFileJsonPath(startDir: string, conversationId: string): Promise<string> {
		const conversationLogsDir = await ConversationLogger.getLogFileDirPath(startDir, conversationId);
		return join(conversationLogsDir, 'conversation.jsonl');
	}

	private async appendToRawLog(content: string) {
		await Deno.writeTextFile(this.logFileRaw, content + '\n', { append: true });
	}
	private async appendToJsonLog(content: string) {
		await Deno.writeTextFile(this.logFileJson, content + '\n', { append: true });
	}

	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private async logEntry(
		logEntry: ConversationLogEntry,
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

		// logEntryHandler handles emitting events for cli and bui
		try {
			await this.logEntryHandler(
				timestamp,
				logEntry,
				conversationStats,
				tokenUsageTurn,
				tokenUsageStatement,
				tokenUsageConversation,
			);
		} catch (error) {
			logger.error('Error in logEntryHandler:', error);
		}

		const rawEntry = this.createRawEntryWithSeparator(
			timestamp,
			logEntry,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
		try {
			await this.appendToRawLog(rawEntry);
		} catch (error) {
			logger.error('Error appending to raw log:', error);
		}

		const jsonEntry = JSON.stringify({
			timestamp,
			logEntry,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		});
		try {
			await this.appendToJsonLog(jsonEntry);
		} catch (error) {
			logger.error('Error appending to json log:', error);
		}
	}

	async logUserMessage(message: string, conversationStats?: ConversationMetrics) {
		await this.logEntry({ entryType: 'user', content: message }, conversationStats);
	}

	async logAssistantMessage(
		message: string,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		await this.logEntry(
			{ entryType: 'assistant', content: message },
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
	}

	async logAuxiliaryMessage(message: string) {
		await this.logEntry(
			{ entryType: 'auxiliary', content: message },
		);
	}

	async logToolUse(
		toolName: string,
		toolInput: LLMToolInputSchema,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		// let message: string;
		// try {
		// 	message = `Tool: ${toolName}\n\n${toolInputFormatter(toolInput, 'console')}`;
		// } catch (error) {
		// 	logger.error(`Error formatting tool use for ${toolName}:`, error);
		// 	message = `Tool: ${toolName}\nInput:\n**Error formatting input**\n${JSON.stringify(error)}`;
		// }
		try {
			await this.logEntry(
				{ entryType: 'tool_use', content: toolInput, toolName },
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
	) {
		// let message: string;
		// try {
		// 	message = `Tool: ${toolName}\nResult:\n${toolRunResultFormatter(toolResult, 'console')}`;
		// } catch (error) {
		// 	logger.error(`Error formatting tool result for ${toolName}:`, error);
		// 	message = `Tool: ${toolName}\nResult:\n**Error formatting result**\n${JSON.stringify(error)}`;
		// }
		try {
			await this.logEntry({ entryType: 'tool_result', content: toolResult, toolName });
		} catch (error) {
			logger.error('Error in logEntry for logToolResult:', error);
		}
	}

	async logError(error: string) {
		await this.logEntry({ entryType: 'error', content: error });
	}

	//async logTextChange(filePath: string, patch: string) {
	//	const message = `Diff Patch for ${filePath}:\n${patch}`;
	//	await this.logEntry('text_change', message);
	//}

	createRawEntry(
		timestamp: string,
		logEntry: ConversationLogEntry,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		// [TODO] add token usage to header line
		const formattedContent = this.logEntryFormatterManager.formatLogEntry(
			'console' as LLMToolFormatterDestination, // [TODO] we need a 'file' destination, use 'console' with ansi stripped
			logEntry,
			{}, // options
		);

		// Convert JSX to HTML string if necessary
		const rawEntryContent = typeof formattedContent === 'string'
			? formattedContent
			: renderToString(formattedContent as JSX.Element);

		const label = ConversationLogger.entryTypeLabels[logEntry.entryType] || 'Unknown';
		return `## ${label} [${timestamp}]\n${rawEntryContent.trim()}`;
	}

	createRawEntryWithSeparator(
		timestamp: string,
		logEntry: ConversationLogEntry,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		let rawEntry = this.createRawEntry(
			timestamp,
			logEntry,
			conversationStats,
			tokenUsage,
			tokenUsageStatement,
			tokenUsageConversation,
		);
		// Ensure entry ends with a single newline and the separator
		rawEntry = rawEntry.trimEnd() + '\n' + ConversationLogger.getEntrySeparator() + '\n';
		return rawEntry;
	}

	static getEntrySeparator(): string {
		return this.ENTRY_SEPARATOR.trim();
	}

	/*
	static async writeLogEntry(
		conversationId: ConversationId,
		type: ConversationLoggerEntryType,
		message: string,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): Promise<void> {
		const logFile = await ConversationLogger.getLogFileRawPath(Deno.cwd(), conversationId);

		const timestamp = new Date().toISOString();
		const entry = ConversationLogFormatter.createRawEntryWithSeparator(
			type,
			timestamp,
			message,
			conversationStats,
			tokenUsage,
			tokenUsageStatement,
			tokenUsageConversation,
		);

		try {
			// Append the entry to the log file
			await Deno.writeTextFile(logFile, entry, { append: true });
		} catch (error) {
			console.error(`Error writing log entry: ${error.message}`);
		}
	}
 */
}
