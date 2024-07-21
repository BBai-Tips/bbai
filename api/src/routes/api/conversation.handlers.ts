import { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { ProjectEditor } from '../../editor/projectEditor.ts';

const projectEditor = new ProjectEditor();

export const startConversation = async (ctx: Context) => {
    logger.debug('startConversation called');
    logger.debug('Request method:', ctx.request.method);
    logger.debug('Request URL:', ctx.request.url);
    logger.debug('Request headers:', ctx.request.headers);

    try {
        const body = await ctx.request.body.json();
        logger.debug('Request body:', body);
        const { prompt, provider, model } = body;

        if (!prompt) {
            logger.warn('Missing prompt');
            ctx.response.status = 400;
            ctx.response.body = { error: 'Missing prompt' };
            return;
        }

        logger.debug('Starting conversation with ProjectEditor');
        const response = await projectEditor.startConversation(prompt, provider, model);

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
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	try {
		const { id: conversationId } = params;
		const persistence = new ConversationPersistence(conversationId);
		const llmProvider = LLMFactory.getProvider(); // Use default provider
		const conversation = await persistence.loadConversation(llmProvider);

		response.status = 200;
		response.body = {
			id: conversation.id,
			providerName: conversation.providerName,
			system: conversation.system,
			model: conversation.model,
			maxTokens: conversation.maxTokens,
			temperature: conversation.temperature,
			turnCount: conversation.turnCount,
			totalTokenUsage: conversation.totalTokenUsage,
			messages: conversation.getMessages(),
		};
	} catch (error) {
		logger.error(`Error in getConversation: ${error.message}`);
		response.status = 404;
		response.body = { error: 'Conversation not found' };
	}
};

export const updateConversation = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Update conversation
	response.body = { message: `Conversation ${params.id} updated` };
};

export const deleteConversation = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Delete conversation
	response.body = { message: `Conversation ${params.id} deleted` };
};

export const listConversations = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const { page = '1', pageSize = '10', startDate, endDate, providerName } = request.url.searchParams;

		// TODO: Implement actual pagination and filtering logic
		const conversations = await ConversationPersistence.listConversations({
			page: parseInt(page),
			pageSize: parseInt(pageSize),
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			providerName,
		});

		response.status = 200;
		response.body = {
			conversations,
			pagination: {
				page: parseInt(page),
				pageSize: parseInt(pageSize),
				totalPages: Math.ceil(conversations.length / parseInt(pageSize)),
				totalItems: conversations.length,
			},
		};
	} catch (error) {
		logger.error(`Error in listConversations: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to list conversations' };
	}
};

export const addMessage = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Add a message to the conversation
	response.body = { message: `Message added to conversation ${params.id}` };
};

export const clearConversation = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Clear conversation history
	response.body = { message: `Conversation ${params.id} cleared` };
};

export const undoConversation = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Undo last change in conversation
	response.body = { message: `Last change in conversation ${params.id} undone` };
};

export const addFile = async (
	{ params, request, response }: {
		params: { id: string };
		request: Context['request'];
		response: Context['response'];
	},
) => {
	try {
		const { id: conversationId } = params;
		const body = await request.body;
		const form: FormData = await body.formData();
		const fileObj: File = form.get('file') as File;
		const filePath = fileObj.name;
		const fileSize = fileObj.size;
		const fileData = await fileObj.stream;

		if (!filePath) {
			response.status = 400;
			response.body = { error: 'Missing filePath in request body' };
			return;
		}

		// TODO: Implement file addition logic
		// For now, we'll just log the file addition
		logger.info(`File ${filePath} added to conversation ${conversationId}`);

		response.status = 200;
		response.body = { message: 'File added to conversation', conversationId, filePath };
	} catch (error) {
		logger.error(`Error in addFile: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to add file to conversation' };
	}
};

export const removeFile = async (
	{ params, response }: { params: { id: string; fileId: string }; response: Context['response'] },
) => {
	try {
		const { id: conversationId, fileId } = params;

		if (!fileId) {
			response.status = 400;
			response.body = { error: 'Missing fileId in request parameters' };
			return;
		}

		// TODO: Implement file removal logic
		// For now, we'll just log the file removal
		logger.info(`File ${fileId} removed from conversation ${conversationId}`);

		response.status = 200;
		response.body = { message: `File ${fileId} removed from conversation`, conversationId, fileId };
	} catch (error) {
		logger.error(`Error in removeFile: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to remove file from conversation' };
	}
};

export const listFiles = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	try {
		const { id: conversationId } = params;

		// TODO: Implement file listing logic
		// For now, we'll return a mock list of files
		const mockFiles = ['file1.txt', 'file2.js', 'file3.py'];

		response.status = 200;
		response.body = { conversationId, files: mockFiles };
	} catch (error) {
		logger.error(`Error in listFiles: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to list files in conversation' };
	}
};
