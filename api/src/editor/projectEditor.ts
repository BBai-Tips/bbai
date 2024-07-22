import { join, resolve, normalize } from '@std/path';
import * as diff from 'diff';

import { LLMFactory } from '../llms/llmProvider.ts';
import LLMConversation from '../llms/conversation.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { PromptManager } from '../prompts/promptManager.ts';
import { LLMProvider, LLMSpeakWithOptions, LLMProviderMessageResponse } from 'shared/types.ts';
import LLMTool from '../llms/tool.ts';
import { ConversationPersistence } from '../utils/conversationPersistence.utils.ts';
import { getProjectRoot } from 'shared/dataDir.ts';
import { createError, ErrorType } from '../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../errors/error.ts';
import { generateCtags, readCtagsFile } from 'shared/ctags.ts';

export class ProjectEditor {
    private conversation: LLMConversation | null = null;
    private promptManager: PromptManager;
    private llmProvider: LLM;
    private projectRoot: string = '';

    constructor() {
        this.promptManager = new PromptManager();
        this.llmProvider = LLMFactory.getProvider();
    }

    public async init(): Promise<void> {
        try {
            this.projectRoot = await getProjectRoot();
        } catch (error) {
            console.error("Failed to get project root:", error);
            this.projectRoot = Deno.env.get("HOME") || Deno.cwd(); // Fallback to user's home directory, or cwd if HOME is not set
        }
    }

    private isPathWithinProject(filePath: string): boolean {
        const normalizedPath = normalize(filePath);
        const resolvedPath = resolve(this.projectRoot, normalizedPath);
        return resolvedPath.startsWith(this.projectRoot);
    }

    private determineStorageLocation(filePath: string, content: string, source: 'tool' | 'user'): 'system' | 'message' {
        const fileSize = new TextEncoder().encode(content).length;
        const fileCount = this.conversation?.listFiles().length || 0;

        if (source === 'user' || (fileCount < 10 && fileSize < 50 * 1024)) {
            return 'system';
        }
        return 'message';
    }

    async speakWithLLM(prompt: string, provider?: LLMProvider, model?: string, conversationId?: string): Promise<any> {
        if (conversationId && !this.conversation) {
            logger.warn(`Conversation ID ${conversationId} not found. Starting a new conversation.`);
            conversationId = undefined;
        }

        if (!this.conversation || !conversationId) {
            this.llmProvider = LLMFactory.getProvider(provider);
            const systemPrompt = await this.promptManager.getPrompt('system', { userDefinedContent: "You are an AI assistant helping with code and project management." });

            this.conversation = this.llmProvider.createConversation();
            this.conversation.baseSystem = systemPrompt;
            if (model) this.conversation.model = model;
            
            // Update ctags
            await this.updateCtags();

            this.addDefaultTools();
        }

        const speakOptions: LLMSpeakWithOptions = {
            temperature: 0.7,
            maxTokens: 1000,
        };

        const maxTurns = 5; // Maximum number of turns for the run loop
        let currentTurn = 0;
        let finalResponse: LLMProviderMessageResponse | null = null;

        while (currentTurn < maxTurns) {
            const response = await this.conversation.speakWithLLM(prompt, speakOptions);
            finalResponse = response;

            // Handle tool calls and collect feedback
            let toolFeedback = '';
            if (response.toolsUsed && response.toolsUsed.length > 0) {
                for (const tool of response.toolsUsed) {
                    const feedback = await this.handleToolUse(tool, response);
                    toolFeedback += feedback + '\n';
                }
            }

            // If there's tool feedback, send it back to the LLM
            if (toolFeedback) {
                prompt = `Tool use feedback:\n${toolFeedback}\nPlease acknowledge this feedback and continue the conversation.`;
                currentTurn++;
            } else {
                // No more tool feedback, exit the loop
                break;
            }
        }

        if (currentTurn >= maxTurns) {
            logger.warn(`Reached maximum number of turns (${maxTurns}) in conversation.`);
        }

        return finalResponse;
    }

    private async handleToolUse(tool: any, response: any): Promise<string> {
        let feedback = '';
        switch (tool.toolName) {
            case 'request_files':
                const fileNames = (tool.toolInput as { fileNames: string[] }).fileNames;
                await this.handleRequestFiles(fileNames, tool.toolUseId);
                feedback = `Files added to the conversation: ${fileNames.join(', ')}`;
                break;
            case 'vector_search':
                const query = (tool.toolInput as { query: string }).query;
                const searchResults = await this.handleVectorSearch(query);
                response.searchResults = searchResults;
                feedback = `Vector search completed for query: "${query}". ${searchResults.length} results found.`;
                break;
            case 'apply_patch':
                const { filePath, patch } = tool.toolInput as { filePath: string; patch: string };
                await this.applyPatch(filePath, patch);
                feedback = `Patch applied successfully to file: ${filePath}`;
                break;
            default:
                logger.warn(`Unknown tool used: ${tool.toolName}`);
                feedback = `Unknown tool used: ${tool.toolName}`;
        }
        return feedback;
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

        this.conversation?.addTool(requestFilesTool);
        this.conversation?.addTool(vectorSearchTool);
        this.conversation?.addTool(applyPatchTool);
    }

    async addFile(filePath: string, content: string, source: 'tool' | 'user', toolUseId?: string): Promise<void> {
        if (!this.conversation) {
            throw new Error("Conversation not started. Call startConversation first.");
        }

        if (!this.isPathWithinProject(filePath)) {
            throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
                filePath,
                operation: 'write',
            } as FileHandlingErrorOptions);
        }

        try {
            const metadata = {
                size: new TextEncoder().encode(content).length,
                lastModified: new Date(),
            };

            const storageLocation = this.determineStorageLocation(filePath, content, source);

            if (storageLocation === 'system') {
                await this.conversation.addFileForSystemPrompt(filePath, metadata);
            } else {
                await this.conversation.addFileToMessageArray(filePath, metadata);
            }

            logger.info(`File ${filePath} added to the project and LLM conversation as a ${source} result`);
        } catch (error) {
            logger.error(`Error adding file ${filePath}: ${error.message}`);
            throw createError(ErrorType.FileHandling, `Failed to add file ${filePath}`, {
                filePath,
                operation: 'write',
            } as FileHandlingErrorOptions);
        }
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

    async handleRequestFiles(fileNames: string[], toolUseId: string): Promise<void> {
        for (const fileName of fileNames) {
            if (!this.isPathWithinProject(fileName)) {
                logger.warn(`Access denied: ${fileName} is outside the project directory`);
                continue;
            }

            try {
                const content = await Deno.readTextFile(fileName);
                await this.addFile(fileName, content, 'tool', toolUseId);
                logger.info(`File ${fileName} added to the chat`);
            } catch (error) {
                logger.error(`Error handling file ${fileName}: ${error.message}`);
            }
        }
    }

    async handleVectorSearch(query: string): Promise<any> {
        return await this.searchEmbeddings(query);
    }

    async applyPatch(filePath: string, patch: string): Promise<void> {
        if (!this.isPathWithinProject(filePath)) {
            throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
                filePath,
                operation: 'patch',
            } as FileHandlingErrorOptions);
        }

        try {
            const currentContent = await Deno.readTextFile(filePath);
            
            const patchedContent = diff.applyPatch(currentContent, patch, {
                fuzzFactor: 2,
            });

            if (patchedContent === false) {
                throw createError(ErrorType.FileHandling, 'Failed to apply patch. The patch does not match the current file content.', {
                    filePath,
                    operation: 'patch',
                } as FileHandlingErrorOptions);
            }

            await Deno.writeTextFile(filePath, patchedContent);
            logger.info(`Patch applied to file: ${filePath}`);

            // Log the applied patch
            if (this.conversation) {
                const persistence = new ConversationPersistence(this.conversation.id);
                await persistence.logPatch(filePath, patch);
            }

            // Update ctags after applying the patch
            await this.updateCtags();
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                throw createError(ErrorType.FileHandling, `File not found: ${filePath}`, {
                    filePath,
                    operation: 'read',
                } as FileHandlingErrorOptions);
            } else if (error instanceof Deno.errors.PermissionDenied) {
                throw createError(ErrorType.FileHandling, `Permission denied for file: ${filePath}`, {
                    filePath,
                    operation: 'write',
                } as FileHandlingErrorOptions);
            } else {
                logger.error(`Error applying patch to ${filePath}: ${error.message}`);
                throw createError(ErrorType.FileHandling, `Failed to apply patch to ${filePath}`, {
                    filePath,
                    operation: 'patch',
                } as FileHandlingErrorOptions);
            }
        }
    }

    private async updateCtags(): Promise<void> {
        await generateCtags();
        const ctagsContent = await readCtagsFile();
        if (ctagsContent && this.conversation) {
            this.conversation.ctagsContent = ctagsContent;
        }
    }

    async revertLastPatch(): Promise<void> {
        if (!this.conversation) {
            throw new Error("No active conversation. Cannot revert patch.");
        }

        const persistence = new ConversationPersistence(this.conversation.id);
        const patchLog = await persistence.getPatchLog();

        if (patchLog.length === 0) {
            throw new Error("No patches to revert.");
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
