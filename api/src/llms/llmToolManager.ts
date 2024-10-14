import type ProjectEditor from '../editor/projectEditor.ts';
import type LLMConversationInteraction from './interactions/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';

import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunBbaiResponse, LLMToolRunResultContent, LLMToolRunToolResponse } from 'api/llms/llmTool.ts';

import { createError, ErrorType } from 'api/utils/error.ts';
import type { LLMValidationErrorOptions } from '../errors/error.ts';
import { logger } from 'shared/logger.ts';
import type { FullConfigSchema } from 'shared/configManager.ts';

import { compare as compareVersions, parse as parseVersion } from '@std/semver';
import { isAbsolute, join, SEPARATOR } from '@std/path';
import { exists } from '@std/fs';

import { CORE_TOOLS } from './tools_manifest.ts';

export interface ToolMetadata {
	name: string;
	version: string;
	author: string;
	license: string;
	description: string;
	path?: string; // is set by code, not part of manifest
	toolSets?: string | string[]; //defaults to 'core'
	category?: string | string[];
	enabled?: boolean; //defaults to true
	mutates?: boolean; //defaults to true
	error?: string;
	config?: unknown;
}

export type LLMToolManagerToolSetType = 'core' | 'coding' | 'research' | 'creative';

class LLMToolManager {
	private toolMetadata: Map<string, ToolMetadata> = new Map();
	private loadedTools: Map<string, LLMTool> = new Map();
	private fullConfig: FullConfigSchema;
	public toolSet: LLMToolManagerToolSetType | LLMToolManagerToolSetType[];

	constructor(
		fullConfig: FullConfigSchema,
		toolSet: LLMToolManagerToolSetType | LLMToolManagerToolSetType[] = 'core',
	) {
		this.fullConfig = fullConfig;
		this.toolSet = toolSet;
	}

	async init() {
		await this.loadToolMetadata(this.fullConfig.api.userToolDirectories);

		return this;
	}

	private async loadToolMetadata(directories: string[]) {
		for (const coreTool of CORE_TOOLS) {
			const toolNamePath = join('tools', coreTool.toolNamePath);
			coreTool.metadata.path = toolNamePath;
			//logger.debug(`LLMToolManager: Metadata for CORE tool ${coreTool.toolNamePath}`, coreTool.metadata);
			logger.debug(`LLMToolManager: Setting metadata for CORE tool ${coreTool.toolNamePath}`);
			this.toolMetadata.set(coreTool.metadata.name, coreTool.metadata);
		}

		//logger.debug(`LLMToolManager: Processing tool directories:`, directories);
		for (const directory of directories) {
			logger.debug(`LLMToolManager: Checking ${directory} for tools`);
			try {
				if (!await exists(directory)) {
					logger.warn(`LLMToolManager: Skipping ${directory} as it is does not exist`);
					continue;
				}
				const directoryInfo = await Deno.stat(directory);
				if (!directoryInfo.isDirectory) {
					logger.warn(`LLMToolManager: Skipping ${directory} as it is not a directory`);
					continue;
				}

				for await (const entry of Deno.readDir(directory)) {
					//logger.debug(`LLMToolManager: Reading ${directory} for tool info`, entry);
					if (entry.isDirectory && entry.name.endsWith('.tool')) {
						try {
							const toolPath = join(directory, entry.name);
							const metadataInfoPath = join(toolPath, 'info.json');
							const metadata: ToolMetadata = JSON.parse(await Deno.readTextFile(metadataInfoPath));
							metadata.path = toolPath;
							//logger.debug(`LLMToolManager: Metadata for ${entry.name}`, metadata);

							if (this.isToolInSet(metadata)) {
								logger.debug(`LLMToolManager: Tool ${metadata.name} is available in tool set`);
								if (this.toolMetadata.has(metadata.name)) {
									//logger.debug(`LLMToolManager: Tool ${metadata.name} has already been loaded`);
									const existingMetadata = this.toolMetadata.get(metadata.name)!;
									if (this.shouldReplaceExistingTool(existingMetadata, metadata)) {
										//logger.debug(`LLMToolManager: Tool ${metadata.name} metadata is being saved [1]`);
										this.toolMetadata.set(metadata.name, metadata);
									} else {
										logger.warn(
											`LLMToolManager: Tool ${metadata.name} has already been loaded and shouldn't be replaced`,
										);
									}
								} else {
									//logger.debug(`LLMToolManager: Tool ${metadata.name} metadata is being saved [2]`);
									this.toolMetadata.set(metadata.name, metadata);
								}
							} else {
								logger.warn(
									`LLMToolManager: Tool ${entry.name} is not in tool set ${
										Array.isArray(this.toolSet) ? this.toolSet.join(', ') : this.toolSet
									}`,
								);
							}
						} catch (error) {
							logger.error(
								`LLMToolManager: Error loading tool metadata for ${entry.name}: ${error.message}`,
							);
						}
					}
				}
			} catch (error) {
				logger.error(`LLMToolManager: Error processing directory ${directory}: ${error.message}`);
				//logger.debug(`LLMToolManager: ERROR - Loading tool metadata in directory ${directory}:`, error);
			}
		}
	}

	private isToolInSet(metadata: ToolMetadata): boolean {
		const metadataSets = metadata.toolSets
			? (Array.isArray(metadata.toolSets) ? metadata.toolSets : [metadata.toolSets])
			: ['core'];
		const requestedSets = Array.isArray(this.toolSet) ? this.toolSet : [this.toolSet];
		return metadataSets.some((set) => requestedSets.includes(set as LLMToolManagerToolSetType));
	}

	private isToolEnabled(metadata: ToolMetadata): boolean {
		// enabled may not be set in metadata, so default to true
		return metadata.enabled !== false;
	}

	private shouldReplaceExistingTool(existing: ToolMetadata, newMetadata: ToolMetadata): boolean {
		// Prefer user-supplied tools
		if (this.fullConfig.api.userToolDirectories.some((dir) => newMetadata.path!.startsWith(dir))) {
			if (compareVersions(parseVersion(existing.version), parseVersion(newMetadata.version)) > 0) {
				logger.warn(
					`LLMToolManager: User-supplied tool ${newMetadata.name} (${newMetadata.version}) is older than built-in tool (${existing.version})`,
				);
			}
			return true;
		}
		return false;
	}

	async getTool(name: string): Promise<LLMTool | undefined> {
		//logger.debug(`LLMToolManager: Getting Tool ${name}`);
		if (this.loadedTools.has(name)) {
			logger.info(`LLMToolManager: Returning cached ${name} tool`);
			return this.loadedTools.get(name);
		}

		const metadata = this.toolMetadata.get(name);
		if (!metadata) {
			logger.warn(`LLMToolManager: Tool ${name} not found`);
			return undefined;
		}

		if (!this.isToolEnabled(metadata)) {
			logger.warn(`LLMToolManager: Tool ${name} is disabled`);
			return undefined;
		}

		// Proceed with loading the tool

		try {
			//logger.debug(`LLMToolManager: Is tool ${name} absolute ${metadata.path}`);
			const toolPath = isAbsolute(metadata.path!)
				? join(metadata.path!, 'tool.ts')
				: `.${SEPARATOR}${metadata.path}${SEPARATOR}tool.ts`;
			//logger.debug(`LLMToolManager: Tool ${name} is loading from ${toolPath}`);
			const module = await import(toolPath);
			const tool = await new module.default(
				metadata.name,
				metadata.description,
				this.fullConfig.api.toolConfigs[name] || {},
			).init();
			logger.info(`LLMToolManager: Loaded Tool ${tool.name}`);
			this.loadedTools.set(name, tool);
			return tool;
		} catch (error) {
			logger.error(`LLMToolManager: Error loading tool ${name}: ${error.message}`);
			metadata.error = error.message;
			return undefined;
		}
	}

	getToolFileName(name: string): string | undefined {
		const metadata = this.toolMetadata.get(name);
		return metadata ? `${metadata.path}/tool.ts` : undefined;
	}

	async getAllTools(enabledOnly = true): Promise<LLMTool[]> {
		const tools: LLMTool[] = [];
		for (const metadata of this.toolMetadata.values()) {
			if (enabledOnly && this.isToolEnabled(metadata)) {
				const tool = await this.getTool(metadata.name);
				if (tool) {
					tools.push(tool);
				}
			}
		}
		return tools;
	}

	getAllToolsMetadata(): Map<string, ToolMetadata> {
		return this.toolMetadata;
	}

	getToolMetadata(): ToolMetadata[] {
		return Array.from(this.toolMetadata.values());
	}

	async handleToolUse(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<
		{
			messageId: string;
			toolResults: LLMToolRunResultContent;
			toolResponse: LLMToolRunToolResponse;
			bbaiResponse: LLMToolRunBbaiResponse;
			isError: boolean;
		}
	> {
		const tool = await this.getTool(toolUse.toolName);
		if (!tool) {
			logger.warn(`llmToolManager: Unknown tool used: ${toolUse.toolName}`);
			throw new Error(`Unknown tool used: ${toolUse.toolName}`);
		}
		try {
			if (!toolUse.toolValidation.validated && !tool.validateInput(toolUse.toolInput)) {
				throw createError(ErrorType.LLMValidation, `Invalid input for ${toolUse.toolName} tool`, {
					name: `tool_use-${toolUse.toolName}`,
					validation_type: 'input_schema',
					validation_error: 'Input does not match the required schema',
				} as LLMValidationErrorOptions);
			} else {
				logger.info(
					`llmToolManager: handleToolUse - Tool ${toolUse.toolName} validated with results: ${toolUse.toolValidation.results}`,
				);
			}

			//logger.info(`llmToolManager: handleToolUse - Running Tool ${toolUse.toolName} with: `, toolUse);
			const { toolResults, toolResponse, bbaiResponse, finalizeCallback } = await tool.runTool(
				interaction,
				toolUse,
				projectEditor,
			);

			//logger.info(`llmToolManager: handleToolUse - Adding results for tool ${toolUse.toolName} with: `, toolResults);
			const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, toolResults, false) || '';

			if (finalizeCallback) {
				logger.info(
					`llmToolManager: handleToolUse - Tool ${toolUse.toolName} is being finalized for messageId: ${messageId}`,
				);
				finalizeCallback(messageId);
			}

			return {
				messageId,
				toolResults,
				toolResponse,
				bbaiResponse,
				isError: false,
			};
		} catch (error) {
			logger.error(`llmToolManager: Error executing tool ${toolUse.toolName}: ${error.message}`);

			const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, error.message, true) || '';

			return {
				messageId,
				toolResults: [],
				toolResponse: `Error with ${toolUse.toolName}: ${error.message}`,
				bbaiResponse: 'BBai could not run the tool',
				isError: true,
			};
		}
	}
}

export default LLMToolManager;
