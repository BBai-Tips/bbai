import { Context } from '@oak/oak';

export const persistConversation = async (ctx: Context) => {
	// Persist current conversation to disk
	ctx.response.body = { message: 'Conversation persisted to disk' };
};

export const resumeConversation = async (ctx: Context) => {
	// Resume conversation from disk
	ctx.response.body = { message: 'Conversation resumed from disk' };
};
