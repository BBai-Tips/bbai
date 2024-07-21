import { Context } from '@oak/oak';

import { LLMFactory } from '../../llms/llmProvider.ts';
import { logger } from 'shared/logger.ts';

export const startConversation = async (ctx: Context) => {
    logger.debug('startConversation called');
    logger.debug('Request method:', ctx.request.method);
    logger.debug('Request URL:', ctx.request.url);
    logger.debug('Request headers:', ctx.request.headers);

    try {
        const body = await ctx.request.body.json();
        logger.debug('Request body:', body);
        const { prompt, provider, model, system } = body;

        //if (!prompt || !provider) {
        if (!system || !prompt) {
            logger.warn('Missing prompt or provider');
            ctx.response.status = 400;
            ctx.response.body = { error: 'Missing prompt or provider' };
            return;
        }

        logger.debug('Creating LLM provider:', provider);
        const llmProvider = LLMFactory.getProvider(provider);
        
        logger.debug('Calling llmProvider.speakWith');
        const response = await llmProvider.speakWith({
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
            system: system || '',
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
