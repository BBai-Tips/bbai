import { Context } from '@oak/oak';

import { LLMFactory } from '../../llms/llmProvider.ts';
import { logger } from 'shared/logger.ts';

export const startConversation = async (ctx: Context) => {
    const body = await ctx.request.body.json();
    const { prompt, provider, model, system } = body;

    if (!prompt || !provider) {
        ctx.response.status = 400;
        ctx.response.body = { error: 'Missing prompt or provider' };
        return;
    }

    try {
        const llmProvider = LLMFactory.getProvider(provider);
        const response = await llmProvider.speakWith({
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
            system: system || '',
            prompt: prompt,
            model: model || '',
        });
        ctx.response.body = response;
    } catch (error) {
        logger.error(`Error generating response: ${error.message}`);
        ctx.response.status = 500;
        ctx.response.body = { error: 'Failed to generate response' };
    }
};

export const getConversation = async (ctx: Context) => {
    // Get conversation details
    const id = ctx.params.id;
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
