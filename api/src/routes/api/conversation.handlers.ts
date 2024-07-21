import { Context } from '@oak/oak';
import { LLMFactory } from '../../llms/llmProvider.ts';
import { logger } from 'shared/logger.ts';
import { PromptManager } from '../../prompts/promptManager.ts';

const promptManager = new PromptManager();

export const startConversation = async (ctx: Context) => {
    logger.debug('startConversation called');
    logger.debug('Request method:', ctx.request.method);
    logger.debug('Request URL:', ctx.request.url);
    logger.debug('Request headers:', ctx.request.headers);

    try {
        const body = await ctx.request.body.json();
        logger.debug('Request body:', body);
        const { prompt, provider, model, system } = body;

        if (!system || !prompt) {
            logger.warn('Missing system or prompt');
            ctx.response.status = 400;
            ctx.response.body = { error: 'Missing system or prompt' };
            return;
        }

        logger.debug('Creating LLM provider:', provider);
        const llmProvider = LLMFactory.getProvider(provider);
        
        const systemPrompt = await promptManager.getPrompt('system', { userDefinedContent: system });
        
        logger.debug('Calling llmProvider.speakWith');
        const response = await llmProvider.speakWith({
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
            system: systemPrompt,
            prompt: prompt,
            model: model || '',
        });
        
        logger.debug('LLM response:', response);
        ctx.response.body = response;
    } catch (error) {
        logger.error(`Error in startConversation: ${error.message}`);
        logger.error('Error stack:', error.stack);
        ctx.response.status = 500;
        ctx.response.body = { error: 'Failed to generate response' };
    }

    logger.debug('Response status:', ctx.response.status);
    logger.debug('Response body:', ctx.response.body);
};

export const getConversation = async (
    { params, response }: { params: { id: string }; response: Context['response'] }
) => {
    // Get conversation details
    response.body = { message: `Conversation ${params.id} details` };
};

export const updateConversation = async (
    { params, response }: { params: { id: string }; response: Context['response'] }
) => {
    // Update conversation
    response.body = { message: `Conversation ${params.id} updated` };
};

export const deleteConversation = async (
    { params, response }: { params: { id: string }; response: Context['response'] }
) => {
    // Delete conversation
    response.body = { message: `Conversation ${params.id} deleted` };
};

export const addMessage = async (
    { params, response }: { params: { id: string }; response: Context['response'] }
) => {
    // Add a message to the conversation
    response.body = { message: `Message added to conversation ${params.id}` };
};

export const clearConversation = async (
    { params, response }: { params: { id: string }; response: Context['response'] }
) => {
    // Clear conversation history
    response.body = { message: `Conversation ${params.id} cleared` };
};

export const undoConversation = async (
    { params, response }: { params: { id: string }; response: Context['response'] }
) => {
    // Undo last change in conversation
    response.body = { message: `Last change in conversation ${params.id} undone` };
};

export const addFile = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { conversationId, filePath } = body;

        // TODO: Implement file addition logic
        // For now, we'll just log the file addition
        logger.info(`File ${filePath} added to conversation ${conversationId}`);

        ctx.response.status = 200;
        ctx.response.body = { message: 'File added to conversation' };
    } catch (error) {
        logger.error(`Error in addFile: ${error.message}`);
        ctx.response.status = 500;
        ctx.response.body = { error: 'Failed to add file to conversation' };
    }
};

export const removeFile = async (ctx: Context) => {
    try {
        const { id } = ctx.params;
        const body = await ctx.request.body.json();
        const { conversationId } = body;

        // TODO: Implement file removal logic
        // For now, we'll just log the file removal
        logger.info(`File ${id} removed from conversation ${conversationId}`);

        ctx.response.status = 200;
        ctx.response.body = { message: `File ${id} removed from conversation` };
    } catch (error) {
        logger.error(`Error in removeFile: ${error.message}`);
        ctx.response.status = 500;
        ctx.response.body = { error: 'Failed to remove file from conversation' };
    }
};

export const listFiles = async (ctx: Context<State, { params: { id: string } }>) => {
    try {
        const { id } = ctx.params;

        // TODO: Implement file listing logic
        // For now, we'll return a mock list of files
        const mockFiles = ['file1.txt', 'file2.js', 'file3.py'];

        ctx.response.status = 200;
        ctx.response.body = { files: mockFiles };
    } catch (error) {
        logger.error(`Error in listFiles: ${error.message}`);
        ctx.response.status = 500;
        ctx.response.body = { error: 'Failed to list files in conversation' };
    }
};
