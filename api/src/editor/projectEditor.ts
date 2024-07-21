import { LLMFactory } from '../llms/llmProvider.ts';
import LLMConversation from '../llms/conversation.ts';
import LLM from '../llms/providers/baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { PromptManager } from '../prompts/promptManager.ts';
import { LLMProvider, LLMSpeakWithOptions } from 'shared/types.ts';
import LLMTool from '../llms/tool.ts';

export class ProjectEditor {
    private conversation: LLMConversation | null = null;
    private promptManager: PromptManager;
    private llmProvider: LLM;

    constructor() {
        this.promptManager = new PromptManager();
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

        // Handle tool calls
        if (response.toolsUsed && response.toolsUsed.length > 0) {
            for (const tool of response.toolsUsed) {
                if (tool.toolName === 'request_files') {
                    await this.handleRequestFiles(tool.toolInput.fileNames);
                } else if (tool.toolName === 'vector_search') {
                    const searchResults = await this.handleVectorSearch(tool.toolInput.query);
                    response.searchResults = searchResults;
                }
            }
        }

        return response;
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

        // Handle tool calls
        if (response.toolsUsed && response.toolsUsed.length > 0) {
            for (const tool of response.toolsUsed) {
                if (tool.toolName === 'apply_patch') {
                    await this.applyPatch(tool.toolInput.filePath, tool.toolInput.patch);
                }
            }
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

    async addFile(filePath: string, content: string): Promise<void> {
        // TODO: Implement file addition logic
        logger.info(`File ${filePath} added to the project`);
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

    async handleRequestFiles(fileNames: string[]): Promise<void> {
        for (const fileName of fileNames) {
            try {
                const content = await Deno.readTextFile(fileName);
                await this.addFile(fileName, content);
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
            
            if (!this.validatePatch(currentContent, patch)) {
                throw new Error('Patch validation failed. The patch does not match the current file content.');
            }

            const updatedContent = this.applyDiffPatch(currentContent, patch);
            await Deno.writeTextFile(filePath, updatedContent);
            logger.info(`Patch applied to file: ${filePath}`);
        } catch (error) {
            logger.error(`Error applying patch to ${filePath}: ${error.message}`);
            throw error;
        }
    }

    private validatePatch(originalContent: string, patch: string): boolean {
        const lines = originalContent.split('\n');
        const patchLines = patch.split('\n');
        let lineIndex = 0;

        for (const patchLine of patchLines) {
            if (patchLine.startsWith('---') || patchLine.startsWith('+++')) {
                continue;
            }

            if (patchLine.startsWith('@@')) {
                const match = patchLine.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
                if (match) {
                    lineIndex = parseInt(match[3]) - 1;
                }
                continue;
            }

            if (patchLine.startsWith('-')) {
                if (lines[lineIndex] !== patchLine.slice(1)) {
                    return false;
                }
                lineIndex++;
            } else if (patchLine.startsWith('+')) {
                // No validation needed for additions
            } else {
                lineIndex++;
            }
        }

        return true;
    }

    private applyDiffPatch(originalContent: string, patch: string): string {
        const lines = originalContent.split('\n');
        const patchLines = patch.split('\n');
        let lineIndex = 0;

        for (const patchLine of patchLines) {
            if (patchLine.startsWith('---') || patchLine.startsWith('+++')) {
                continue;
            }

            if (patchLine.startsWith('@@')) {
                const match = patchLine.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
                if (match) {
                    lineIndex = parseInt(match[3]) - 1;
                }
                continue;
            }

            if (patchLine.startsWith('-')) {
                lines.splice(lineIndex, 1);
            } else if (patchLine.startsWith('+')) {
                lines.splice(lineIndex, 0, patchLine.slice(1));
                lineIndex++;
            } else {
                lineIndex++;
            }
        }

        return lines.join('\n');
    }
}
