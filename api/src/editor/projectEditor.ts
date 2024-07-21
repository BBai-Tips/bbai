import { LLMFactory } from '../llms/llmProvider.ts';
import LLMConversation from '../llms/conversation.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { PromptManager } from '../prompts/promptManager.ts';
import { LLMProvider, LLMSpeakWithOptions } from 'shared/types.ts';
import LLMTool from '../llms/tool.ts';
import * as diff from 'diff';
import { ConversationPersistence } from '../utils/conversationPersistence.utils.ts';

export class ProjectEditor {
    private conversation: LLMConversation | null = null;
    private promptManager: PromptManager;
    private llmProvider: LLM;

    constructor() {
        this.promptManager = new PromptManager();
        this.llmProvider = LLMFactory.getProvider(); // Initialize llmProvider
    }

    private determineStorageLocation(filePath: string, content: string, source: 'tool' | 'user'): 'system' | 'message' {
        const fileSize = new TextEncoder().encode(content).length;
        const fileCount = this.conversation?.listFiles().length || 0;

        if (source === 'user' || (fileCount < 10 && fileSize < 50 * 1024)) {
            return 'system';
        }
        return 'message';
    }

    async startConversation(prompt: string, provider: LLMProvider, model: string): Promise<any> {
        this.llmProvider = LLMFactory.getProvider(provider);
        const systemPrompt = await this.promptManager.getPrompt('system', { userDefinedContent: "You are an AI assistant helping with code and project management." });

        this.conversation = this.llmProvider.createConversation();
        this.conversation.system = systemPrompt;
        this.conversation.model = model;
        
        this.addDefaultTools();

        const speakOptions: LLMSpeakWithOptions = {
            temperature: 0.7,
            maxTokens: 1000,
        };

        const response = await this.conversation.speakWithLLM(prompt, speakOptions);

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
            const feedbackPrompt = `Tool use feedback:\n${toolFeedback}\nPlease acknowledge this feedback and continue the conversation.`;
            const feedbackResponse = await this.conversation.speakWithLLM(feedbackPrompt, speakOptions);
            response.toolFeedback = feedbackResponse;
        }

        return response;
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

    async continueConversation(prompt: string): Promise<any> {
        if (!this.conversation) {
            throw new Error("Conversation not started. Call startConversation first.");
        }

        const speakOptions: LLMSpeakWithOptions = {
            temperature: 0.7,
            maxTokens: 1000,
        };

        const response = await this.conversation.speakWithLLM(prompt, speakOptions);

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
            const feedbackPrompt = `Tool use feedback:\n${toolFeedback}\nPlease acknowledge this feedback and continue the conversation.`;
            const feedbackResponse = await this.conversation.speakWithLLM(feedbackPrompt, speakOptions);
            response.toolFeedback = feedbackResponse;
        }

        return response;
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

        try {
            const metadata = {
                path: filePath,
                size: new TextEncoder().encode(content).length,
                last_modified: new Date().toISOString(),
                source: source,
            };

            const storageLocation = this.determineStorageLocation(filePath, content, source);

            if (storageLocation === 'system') {
                await this.conversation.addFileToSystemPrompt(filePath, content, metadata);
            } else {
                const toolResult = {
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    content: [
                        {
                            type: 'text',
                            text: content
                        }
                    ],
                    metadata: metadata
                };

                await this.conversation.addMessage({
                    role: 'user',
                    content: [toolResult]
                });
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
            try {
                const content = await Deno.readTextFile(fileName);
                await this.addFile(fileName, content, 'tool', toolUseId);
                logger.info(`File ${fileName} added to the chat`);
            } catch (error) {
                logger.error(`Error adding file ${fileName}: ${error.message}`);
            }
        }
    }

    async handleVectorSearch(query: string): Promise<any> {
        return await this.searchEmbeddings(query);
    }

    async applyPatch(filePath: string, patch: string): Promise<void> {
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
