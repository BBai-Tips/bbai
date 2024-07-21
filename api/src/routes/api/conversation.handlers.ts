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

export const getConversation = async (ctx: Context) => {
    // Get conversation details
    const id = (ctx.params as { id: string }).id;
    ctx.response.body = { message: `Conversation ${id} details` };
};

export const updateConversation = async (ctx: Context) => {
    // Update conversation
    const id = ctx.params.id;
    ctx.response.body = { message: `Conversation ${id} updated` };
};

export const deleteConversation = async (ctx: Context) => {
    // Delete conversation
    const id = ctx.params.id;
    ctx.response.body = { message: `Conversation ${id} deleted` };
};

export const addMessage = async (ctx: Context) => {
    // Add a message to the conversation
    const id = ctx.params.id;
    ctx.response.body = { message: `Message added to conversation ${id}` };
};

export const clearConversation = async (ctx: Context) => {
    // Clear conversation history
    const id = ctx.params.id;
    ctx.response.body = { message: `Conversation ${id} cleared` };
};

export const undoConversation = async (ctx: Context) => {
    // Undo last change in conversation
    const id = ctx.params.id;
    ctx.response.body = { message: `Last change in conversation ${id} undone` };
};
