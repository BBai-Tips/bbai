import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolConfig, LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
//import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

import { AnthropicProvider } from './providers/anthropic.ts';
import { OpenAIProvider } from './providers/openai.ts';
import { GeminiProvider } from './providers/gemini.ts';

export interface ModelProvider {
	query(model: string, prompt: string): Promise<string>;
}

const MODELS = [
	//anthropic
	'claude-3-5-sonnet-20240620',
	'claude-3-opus-20240229',
	'claude-3-sonnet-20240229',
	'claude-3-haiku-20240307',
	//openai
	'gpt-4o',
	'gpt-4o-mini',
	'gpt-4-turbo',
	'gpt-4',
	'gpt-3.5-turbo',
	//google
	'gemini-pro',
	//'gemini-pro-vision',
];
const MODELS_PROVIDERS = {
	//anthropic
	'claude-3-5-sonnet-20240620': 'anthropic',
	'claude-3-opus-20240229': 'anthropic',
	'claude-3-sonnet-20240229': 'anthropic',
	'claude-3-haiku-20240307': 'anthropic',
	//openai
	'gpt-4o': 'openai',
	'gpt-4o-mini': 'openai',
	'gpt-4-turbo': 'openai',
	'gpt-4': 'openai',
	'gpt-3.5-turbo': 'openai',
	//google
	'gemini-pro': 'gemini',
	//'gemini-pro-vision': 'gemini',
} as Record<string, string>;

interface LLMToolMultiModelQueryConfig extends LLMToolConfig {
	openaiApiKey?: string;
	anthropicApiKey?: string;
	geminiApiKey?: string;
	models?: string[];
}

export default class LLMToolMultiModelQuery extends LLMTool {
	public providers: Record<string, ModelProvider> = {};
	private models: Array<string>;

	constructor(name: string, description: string, toolConfig: LLMToolMultiModelQueryConfig) {
		super(
			name,
			description,
			toolConfig,
		);

		this.models = toolConfig.models || MODELS;

		// `description`: Query multiple LLM models with the same prompt and return their exact responses; DO NOT summarize or analyze
		this.description = `${description}. Available models: ${this.models.join(', ')}`;

		if (toolConfig.anthropicApiKey) this.providers.anthropic = new AnthropicProvider(toolConfig.anthropicApiKey);
		if (toolConfig.openaiApiKey) this.providers.openai = new OpenAIProvider(toolConfig.openaiApiKey);
		if (toolConfig.geminiApiKey) this.providers.gemini = new GeminiProvider(toolConfig.geminiApiKey);

		/*
		this.providers = {
			anthropic: new AnthropicProvider(toolConfig.anthropicApiKey),
			openai: new OpenAIProvider(toolConfig.openaiApiKey),
			gemini: new GeminiProvider(toolConfig.geminiApiKey),
		};
		 */

		//logger.debug(`LLMToolMultiModelQuery: models`, this.models);
		//logger.debug(`LLMToolMultiModelQuery: description`, this.description);
		//logger.debug(`LLMToolMultiModelQuery: providers`, this.providers);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'The prompt to send to all models' },
				models: {
					type: 'array',
					items: { type: 'string' },
					/*
					items: {
						type: 'object',
						properties: {
							provider: { type: 'string', enum: ['anthropic', 'openai'] },
							model: { type: 'string' },
						},
						required: ['provider', 'model'],
					},
					 */
					description: 'List of model identifiers to query',
					//description: "List of model identifiers to query (format: 'provider:model')",
				},
			},
			required: ['query', 'models'],
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(toolResult: LLMToolRunResultContent, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(toolResult) : formatToolResultBrowser(toolResult);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { query, models } = toolInput as { query: string; models: string[] };

		logger.info(`LLMToolMultiModelQuery: input`, toolInput);

		try {
			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
			const querySuccess: Array<{ name: string }> = [];
			const queryError: Array<{ name: string; error: string }> = [];

			const modelQueries = models.map(async (modelName: string) => {
				const provider = MODELS_PROVIDERS[modelName];
				const modelIdentifier = `${provider}/${modelName}`;

				if (!this.providers[provider]) {
					return {
						type: 'error',
						modelName,
						modelIdentifier,
						error: `Unsupported provider: ${provider}`,
					};
				}

				try {
					const answer = await this.providers[provider].query(modelName, query);
					return {
						type: 'success',
						modelName,
						modelIdentifier,
						answer,
					};
				} catch (error) {
					return {
						type: 'error',
						modelName,
						modelIdentifier,
						error: error.message,
					};
				}
			});

			const results = await Promise.all(modelQueries);

			results.forEach((result) => {
				if (result.type === 'success') {
					toolResultContentParts.push({
						'type': 'text',
						'text': `**Model: ${result.modelIdentifier}**\n\n# Answer:\n${result.answer}`,
					});
					querySuccess.push({ name: result.modelName });
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error querying ${result.modelIdentifier}: ${result.error}`,
					});
					queryError.push({ name: result.modelIdentifier, error: result.error });
				}
			});

			const bbaiResponses = [];
			const toolResponses = [];
			if (querySuccess.length > 0) {
				bbaiResponses.push(
					`BBai has queried models: ${querySuccess.map((m) => m.name).join(', ')}`,
				);
				toolResponses.push(
					`Queried models:\n${querySuccess.map((m) => `- ${m.name}`).join('\n')}`,
				);
			}
			if (queryError.length > 0) {
				bbaiResponses.push(
					`BBai failed to query models:\n${queryError.map((m) => `- ${m.name}: ${m.error}`).join('\n')}`,
				);
				toolResponses.push(
					`Failed to query models:\n${queryError.map((m) => `- ${m.name}: ${m.error}`).join('\n')}`,
				);
			}

			const toolResults = toolResultContentParts;
			const toolResponse = (querySuccess.length === 0 ? 'No models queried.\n' : '') +
				toolResponses.join('\n\n');
			const bbaiResponse = `${bbaiResponses.join('\n\n')}. You can review their responses in the output.`;

			return {
				toolResults,
				toolResponse,
				bbaiResponse,
			};
		} catch (error) {
			logger.error(`Error querying models: ${error.message}`);
			throw error;
		}
	}
}
