import { dirname, join, normalize, resolve } from '@std/path';
import * as diff from 'diff';
import { ensureDir } from '@std/fs';
import { searchFiles } from 'shared/fileListing.ts';

import { LLMFactory } from '../llms/llmProvider.ts';
import LLMConversation, { FileMetadata, ProjectInfo } from '../llms/conversation.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { PromptManager } from '../prompts/promptManager.ts';
import { LLMProvider, LLMProviderMessageResponse, LLMSpeakWithOptions } from '../types.ts';
import LLMTool from '../llms/tool.ts';
import { ConversationPersistence } from '../utils/conversationPersistence.utils.ts';
//import { GitUtils } from 'shared/git.ts';
import { createError, ErrorType } from '../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../errors/error.ts';
import { generateCtags, readCtagsFile } from 'shared/ctags.ts';
import { FILE_LISTING_TIERS, generateFileListing } from 'shared/fileListing.ts';
import { LLMAnswerToolUse } from '../llms/message.ts';
import {
	getBbaiCacheDir,
	getBbaiDir,
	getProjectRoot,
	readFileContent,
	readFromBbaiDir,
	removeFromBbaiDir,
	writeToBbaiDir,
} from 'shared/dataDir.ts';

export class ProjectEditor {
	private conversation: LLMConversation | null = null;
	private promptManager: PromptManager;
	private llmProvider!: LLM;
	public cwd: string;
	public projectRoot: string;
	private bbaiDir: string;
	private statementCount: number = 0;
	private totalTurnCount: number = 0;
	private _projectInfo: ProjectInfo = {
		type: 'empty',
		content: '',
		tier: null,
	};

	constructor(cwd: string) {
		this.promptManager = new PromptManager(this);
		this.projectRoot = '.';
		this.bbaiDir = '.bbai';
		this.cwd = cwd;
	}

	public async init(): Promise<void> {
		try {
			this.projectRoot = await this.getProjectRoot();
			this.bbaiDir = await this.getBbaiDir();
			this.llmProvider = LLMFactory.getProvider(this);
		} catch (error) {
			console.error('Failed to initialize LLMProvider:', error);
			throw error;
		}
	}

	public async getProjectRoot(): Promise<string> {
		return await getProjectRoot(this.cwd);
	}

	public async getBbaiDir(): Promise<string> {
		return await getBbaiDir(this.cwd);
	}

	public async getBbaiCacheDir(): Promise<string> {
		return await getBbaiCacheDir(this.cwd);
	}

	public async writeToBbaiDir(filename: string, content: string): Promise<void> {
		return await writeToBbaiDir(this.cwd, filename, content);
	}

	public async readFromBbaiDir(filename: string): Promise<string | null> {
		return await readFromBbaiDir(this.cwd, filename);
	}

	public async removeFromBbaiDir(filename: string): Promise<void> {
		return await removeFromBbaiDir(this.cwd, filename);
	}

	get projectInfo(): ProjectInfo {
		return this._projectInfo;
	}

	set projectInfo(projectInfo: ProjectInfo) {
		this._projectInfo = projectInfo;
	}

	protected async updateProjectInfo(): Promise<void> {
		const projectInfo: ProjectInfo = { type: 'empty', content: '', tier: null };

		const bbaiDir = await this.getBbaiDir();
		await generateCtags(this.bbaiDir, this.projectRoot);
		const ctagsContent = await readCtagsFile(bbaiDir);
		if (ctagsContent) {
			projectInfo.type = 'ctags';
			projectInfo.content = ctagsContent;
			projectInfo.tier = 0; // Assuming ctags is always tier 0
		}

		if (projectInfo.type === 'empty') {
			const projectRoot = await this.getProjectRoot();
			const fileListingContent = await generateFileListing(projectRoot);
			if (fileListingContent) {
				projectInfo.type = 'file-listing';
				projectInfo.content = fileListingContent;
				// Determine which tier was used for file listing
				const tier = FILE_LISTING_TIERS.findIndex((t: { depth: number; includeMetadata: boolean }) =>
					t.depth === Infinity && t.includeMetadata === true
				);
				projectInfo.tier = tier !== -1 ? tier : null;
			}
		}

		this.projectInfo = projectInfo;
	}

	private addDefaultTools(): void {
		const requestFilesTool: LLMTool = {
			name: 'request_files',
			description: 'Request files to be added to the chat',
			input_schema: {
				type: 'object',
				properties: {
					fileNames: {
						type: 'array',
						items: { type: 'string' },
						description: 'Array of file names to be added to the chat',
					},
				},
				required: ['fileNames'],
			},
		};

		const vectorSearchTool: LLMTool = {
			name: 'vector_search',
			description: 'Perform a vector search on the project files',
			input_schema: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'The search query to use for vector search',
					},
				},
				required: ['query'],
			},
		};

		const applyPatchTool: LLMTool = {
			name: 'apply_patch',
			description: 'Apply a patch to a file',
			input_schema: {
				type: 'object',
				properties: {
					filePath: {
						type: 'string',
						description: 'The path of the file to be patched',
					},
					patch: {
						type: 'string',
						description: 'The patch to be applied in diff format',
					},
				},
				required: ['filePath', 'patch'],
			},
		};

		const searchProjectTool: LLMTool = {
			name: 'search_project',
			description: 'Search the project for files matching a pattern',
			input_schema: {
				type: 'object',
				properties: {
					pattern: {
						type: 'string',
						description: 'The search pattern to use (grep-compatible regular expression)',
					},
					file_pattern: {
						type: 'string',
						description:
							'Optional file pattern to limit the search to specific file types (e.g., "*.ts" for TypeScript files)',
					},
				},
				required: ['pattern'],
			},
		};

		this.conversation?.addTool(requestFilesTool);
		//this.conversation?.addTool(vectorSearchTool);
		this.conversation?.addTool(applyPatchTool);
		this.conversation?.addTool(searchProjectTool);
	}

	private isPathWithinProject(filePath: string): boolean {
		const normalizedPath = normalize(filePath);
		const resolvedPath = resolve(this.projectRoot, normalizedPath);
		return resolvedPath.startsWith(this.projectRoot);
	}

	private determineStorageLocation(filePath: string, content: string, source: 'tool' | 'user'): 'system' | 'message' {
		if (source === 'tool') {
			return 'message';
		}
		const fileSize = new TextEncoder().encode(content).length;
		const fileCount = this.conversation?.listFiles().length || 0;

		if (fileCount < 10 && fileSize < 50 * 1024) {
			return 'system';
		} else {
			return 'message';
		}
	}

	async speakWithLLM(prompt: string, provider?: LLMProvider, model?: string, conversationId?: string): Promise<any> {
		logger.info(
			`Starting speakWithLLM. Prompt: "${prompt.substring(0, 50)}...", ConversationId: ${conversationId}`,
		);
		logger.debug(`Full prompt: ${prompt}`);
		logger.debug(`Provider: ${provider}, Model: ${model}`);

		if (conversationId) {
			logger.info(`Attempting to load existing conversation: ${conversationId}`);
			try {
				const persistence = new ConversationPersistence(conversationId, this);
				await persistence.init();
				logger.debug(`ConversationPersistence initialized for ${conversationId}`);

				this.conversation = await persistence.loadConversation(this.llmProvider);
				logger.info(`Loaded existing conversation: ${conversationId}`);

				const metadata = await persistence.getMetadata();
				logger.debug(`Retrieved metadata for conversation ${conversationId}`);
				// logger.debug(`Retrieved metadata for conversation ${conversationId}:`, metadata);

				this.statementCount = metadata.statementCount || 0;
				this.totalTurnCount = metadata.totalTurnCount || 0;
				logger.info(
					`Conversation metadata loaded. StatementCount: ${this.statementCount}, TotalTurnCount: ${this.totalTurnCount}`,
				);
			} catch (error) {
				logger.warn(`Failed to load conversation ${conversationId}: ${error.message}`);
				logger.error(`Error details:`, error);
				logger.debug(`Stack trace:`, error.stack);
				this.conversation = null;
			}
		}

		if (!this.conversation) {
			logger.info(`Creating a new conversation.`);
			try {
				const systemPrompt = await this.promptManager.getPrompt('system', {
					userDefinedContent: 'You are an AI assistant helping with code and project management.',
				});

				this.conversation = await this.llmProvider.createConversation();
				//this.conversation.id = conversationId || LLMConversation.generateShortId();
				this.conversation.baseSystem = systemPrompt;
				if (model) this.conversation.model = model;

				this.addDefaultTools();

				logger.info(`Created new conversation: ${this.conversation.id}`);
				this.statementCount = 0;
				this.totalTurnCount = 0;
			} catch (error) {
				logger.error(`Error creating new conversation:`, error);
				throw error;
			}
		}

		this.statementCount++;
		const speakOptions: LLMSpeakWithOptions = {
			//temperature: 0.7,
			//maxTokens: 1000,
		};

		await this.updateProjectInfo();

		const maxTurns = 25; // Maximum number of turns for the run loop
		let turnCount = 0;
		let currentResponse: LLMSpeakWithResponse;

		try {
			logger.info(`Calling speakWithLLM with prompt: "${prompt.substring(0, 50)}..."`);

			currentResponse = await this.conversation.speakWithLLM(prompt, speakOptions);
			logger.info('Received response from LLM');
			//logger.debug('LLM Response:', currentResponse);

			this.totalTurnCount++;
			turnCount++;
		} catch (error) {
			logger.error(`Error in LLM communication:`, error);
			throw error;
		}

		try {
			// Save the conversation immediately after the first response
			logger.info(
				`Saving conversation at beginning of statement: ${this.conversation.id}[${this.statementCount}][${turnCount}]`,
			);
			const persistence = new ConversationPersistence(this.conversation.id, this);
			await persistence.saveConversation(this.conversation);
			await persistence.saveMetadata({
				statementCount: this.statementCount,
				totalTurnCount: this.totalTurnCount,
			});

			// Save system prompt and project info if running in local development
			if (config.api?.environment === 'localdev') {
				await persistence.saveSystemPrompt(this.conversation.baseSystem);
				await persistence.saveProjectInfo(this.projectInfo);
			}

			logger.info(`Saved conversation: ${this.conversation.id}`);
		} catch (error) {
			logger.error(`Error persisting the conversation:`, error);
			throw error;
		}

		while (turnCount < maxTurns) {
			try {
				// Handle tool calls and collect feedback
				let toolFeedback = '';
				if (currentResponse.messageResponse.toolsUsed && currentResponse.messageResponse.toolsUsed.length > 0) {
					for (const tool of currentResponse.messageResponse.toolsUsed) {
						logger.info('Handling tool', tool);
						try {
							const feedback = await this.handleToolUse(tool, currentResponse.messageResponse);
							toolFeedback += feedback + '\n';
						} catch (error) {
							logger.warn(`Error handling tool ${tool.toolName}: ${error.message}`);
							toolFeedback += `Error with ${tool.toolName}: ${error.message}\n`;
						}
					}
				}

				// If there's tool feedback, send it back to the LLM
				if (toolFeedback) {
					try {
						await this.updateProjectInfo();

						prompt =
							`Tool use feedback:\n${toolFeedback}\nPlease acknowledge this feedback and continue the conversation.`;

						turnCount++;
						this.totalTurnCount++;

						currentResponse = await this.conversation.speakWithLLM(prompt, speakOptions);
						//logger.info('tool response', currentResponse);
					} catch (error) {
						logger.error(`Error in LLM communication: ${error.message}`);
						throw error; // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
					}
				} else {
					// No more tool feedback, exit the loop
					break;
				}
			} catch (error) {
				logger.error(`Error in conversation turn ${turnCount}: ${error.message}`);
				if (turnCount === maxTurns - 1) {
					throw error; // If it's the last turn, throw the error to be caught by the outer try-catch
				}
				// For non-fatal errors, log and continue to the next turn
				currentResponse = {
					messageResponse: {
						answerContent: [{
							type: 'text',
							text: `Error occurred: ${error.message}. Continuing conversation.`,
						}],
					},
					messageMeta: {},
				} as LLMSpeakWithResponse;
			}
		}

		if (turnCount >= maxTurns) {
			logger.warn(`Reached maximum number of turns (${maxTurns}) in conversation.`);
		}

		// Final save of the entire conversation at the end of the loop
		logger.info(
			`Saving conversation at end of statement: ${this.conversation.id}[${this.statementCount}][${turnCount}]`,
		);
		const persistence = new ConversationPersistence(this.conversation.id, this);
		await persistence.saveConversation(this.conversation);
		await persistence.saveMetadata({
			statementCount: this.statementCount,
			totalTurnCount: this.totalTurnCount,
		});
		logger.info(`Final save of conversation: ${this.conversation.id}[${this.statementCount}][${turnCount}]`);

		return {
			response: currentResponse.messageResponse,
			messageMeta: currentResponse.messageMeta,
			conversationId: this.conversation?.id || '',
			statementCount: this.statementCount,
			turnCount,
			totalTurnCount: this.totalTurnCount,
		};
	}

	private async handleToolUse(
		tool: LLMAnswerToolUse,
		response: unknown,
	): Promise<string> {
		let feedback = '';
		switch (tool.toolName) {
			case 'request_files': {
				const fileNames = (tool.toolInput as { fileNames: string[] }).fileNames;
				const filesAdded = await this.handleRequestFiles(fileNames, tool.toolUseId || '');
				const addedFileNames = filesAdded.map((file) => file.fileName).join(', ');
				feedback = `Files added to the conversation: ${addedFileNames}`;
				break;
			}
			case 'vector_search': {
				const query = (tool.toolInput as { query: string }).query;
				const vectorSearchResults = await this.handleVectorSearch(query, tool.toolUseId);
				feedback =
					`Vector search completed for query: "${query}". ${vectorSearchResults.length} results found.`;
				break;
			}
			case 'apply_patch': {
				const { filePath, patch } = tool.toolInput as { filePath: string; patch: string };
				await this.handleApplyPatch(filePath, patch, tool.toolUseId);
				feedback = `Patch applied successfully to file: ${filePath}`;
				break;
			}
			case 'search_project': {
				const { pattern, file_pattern } = tool.toolInput as { pattern: string; file_pattern?: string };
				const repoSearchResults = await this.handleSearchProject(
					pattern,
					file_pattern || undefined,
					tool.toolUseId,
				);
				feedback = `Project search completed. ${repoSearchResults.length} files found matching the pattern.`;
				break;
			}
			default: {
				logger.warn(`Unknown tool used: ${tool.toolName}`);
				feedback = `Unknown tool used: ${tool.toolName}`;
			}
		}
		return feedback;
	}

	async handleRequestFiles(
		fileNames: string[],
		toolUseId: string,
	): Promise<Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }>> {
		return await this.addFiles(fileNames, 'tool', toolUseId);
	}

	async handleVectorSearch(query: string, toolUseId: string): Promise<any> {
		return await this.searchEmbeddings(query);
	}

	async handleSearchProject(
		pattern: string,
		file_pattern: string | undefined,
		toolUseId: string,
	): Promise<string[]> {
		try {
			const { files, error } = await searchFiles(this.projectRoot, pattern, file_pattern);

			// Add tool result message
			const resultMessage = `Found ${files.length} files matching the pattern "${pattern}"${
				file_pattern ? ` with file pattern "${file_pattern}"` : ''
			}:\n${files.join('\n')}`;
			this.conversation?.addMessageForToolResult(toolUseId, resultMessage);

			return files;
		} catch (error) {
			const errorMessage = error.message;
			logger.error(`Error searching project: ${errorMessage}`);

			// Add error tool result message
			this.conversation?.addMessageForToolResult(toolUseId, `Error searching project: ${errorMessage}`, true);
			return [];
		}
	}

	async handleApplyPatch(filePath: string, patch: string, toolUseId: string): Promise<void> {
		if (!this.isPathWithinProject(filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				filePath,
				operation: 'patch',
			} as FileHandlingErrorOptions);
		}

		const fullFilePath = join(this.projectRoot, filePath);
		logger.info(`Handling patch for file: ${fullFilePath}\nWith patch:\n${patch}`);

		try {
			const parsedPatch = diff.parsePatch(patch);

			for (const patchPart of parsedPatch) {
				if (patchPart.oldFileName === '/dev/null') {
					// This is a new file
					const newFilePath = patchPart.newFileName
						? join(this.projectRoot, patchPart.newFileName)
						: undefined;
					if (!newFilePath) {
						throw new Error('New file path is undefined');
					}
					const newFileContent = patchPart.hunks.map((h) =>
						h.lines.filter((l) => l[0] === '+').map((l) => l.slice(1)).join('\n')
					).join('\n');

					await ensureDir(dirname(newFilePath));
					await Deno.writeTextFile(newFilePath, newFileContent);
					logger.info(`Created new file: ${patchPart.newFileName}`);
				} else {
					// Existing file, apply patch as before
					const currentContent = await Deno.readTextFile(fullFilePath);

					const patchedContent = diff.applyPatch(currentContent, patchPart, {
						fuzzFactor: 2,
					});

					if (patchedContent === false) {
						throw createError(
							ErrorType.FileHandling,
							'Failed to apply patch. The patch does not match the current file content.',
							{
								filePath,
								operation: 'patch',
							} as FileHandlingErrorOptions,
						);
					}

					await Deno.writeTextFile(fullFilePath, patchedContent);
					logger.info(`Patch applied to existing file: ${filePath}`);
				}
			}

			// Log the applied patch
			if (this.conversation) {
				logger.info(`Saving conversation patch: ${this.conversation.id}`);
				const persistence = new ConversationPersistence(this.conversation.id, this);
				await persistence.logPatch(filePath, patch);
			}

			// Add tool result message
			this.conversation?.addMessageForToolResult(toolUseId, `Patch applied successfully to file: ${filePath}`);
		} catch (error) {
			let errorMessage: string;
			if (error instanceof Deno.errors.NotFound) {
				errorMessage = `File not found: ${filePath}`;
			} else if (error instanceof Deno.errors.PermissionDenied) {
				errorMessage = `Permission denied for file: ${filePath}`;
			} else {
				errorMessage = `Failed to apply patch to ${filePath}: ${error.message}`;
			}
			logger.error(errorMessage);

			// Add error tool result message
			this.conversation?.addMessageForToolResult(toolUseId, errorMessage, true);

			throw createError(ErrorType.FileHandling, errorMessage, {
				filePath: filePath,
				operation: 'patch',
			} as FileHandlingErrorOptions);
		}
	}

	async addFiles(
		fileNames: string[],
		source: 'tool' | 'user',
		toolUseId: string,
	): Promise<Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }>> {
		if (!this.conversation) {
			throw new Error('Conversation not started. Call startConversation first.');
		}

		const filesAdded: Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }> = [];

		for (const fileName of fileNames) {
			try {
				if (!this.isPathWithinProject(fileName)) {
					throw new Error(`Access denied: ${fileName} is outside the project directory`);
				}

				const fullFilePath = join(this.projectRoot, fileName);
				const content = await Deno.readTextFile(fullFilePath);
				const metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> = {
					size: new TextEncoder().encode(content).length,
					lastModified: new Date(),
					error: null,
				};
				filesAdded.push({ fileName, metadata });

				logger.info(`File ${fileName} added to messages by ${source}`);
			} catch (error) {
				logger.error(`Error adding file ${fileName}: ${error.message}`);
				filesAdded.push({
					fileName,
					metadata: {
						size: 0,
						lastModified: new Date(),
						error: error.message,
					},
				});
			}
		}

		this.conversation.addFilesToMessages(filesAdded, toolUseId);

		// const storageLocation = this.determineStorageLocation(fullFilePath, content, source);
		// if (storageLocation === 'system') {
		// 	this.conversation.addFileForSystemPrompt(fileName, metadata);
		// } else {
		// 	this.conversation.addFileToMessages(fileName, metadata, toolUseId);
		// }

		return filesAdded;
	}

	public async readProjectFileContent(filePath: string): Promise<string> {
		const fullFilePath = join(this.projectRoot, filePath);
		logger.info(`Reading contents of File ${fullFilePath}`);
		const content = await readFileContent(fullFilePath);
		if (content === null) {
			throw new Error(`File not found: ${fullFilePath}`);
		}
		return content;
	}

	async updateFile(filePath: string, content: string): Promise<void> {
		if (!this.isPathWithinProject(filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				filePath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}

		// TODO: Implement file update logic
		logger.info(`File ${filePath} updated in the project`);
	}

	async searchEmbeddings(query: string): Promise<any> {
		// TODO: Implement embedding search logic
		logger.info(`Searching embeddings for: ${query}`);
		return [];
	}

	async revertLastPatch(): Promise<void> {
		if (!this.conversation) {
			throw new Error('No active conversation. Cannot revert patch.');
		}

		const persistence = new ConversationPersistence(this.conversation.id, this);
		const patchLog = await persistence.getPatchLog();

		if (patchLog.length === 0) {
			throw new Error('No patches to revert.');
		}

		const lastPatch = patchLog[patchLog.length - 1];
		const { filePath, patch } = lastPatch;

		try {
			const currentContent = await Deno.readTextFile(filePath);

			// Create a reverse patch
			const patchResult = diff.applyPatch(currentContent, patch);
			if (typeof patchResult === 'boolean') {
				throw new Error('Failed to apply original patch. Cannot create reverse patch.');
			}
			const reversePatch = diff.createPatch(filePath, patchResult, currentContent);

			// Apply the reverse patch
			const revertedContent = diff.applyPatch(currentContent, reversePatch);

			if (revertedContent === false) {
				throw new Error('Failed to revert patch. The current file content may have changed.');
			}

			await Deno.writeTextFile(filePath, revertedContent);
			logger.info(`Last patch reverted for file: ${filePath}`);

			// Remove the last patch from the log
			await persistence.removeLastPatch();
		} catch (error) {
			logger.error(`Error reverting last patch: ${error.message}`);
			throw error;
		}
	}
}
