import { Context, RouterContext } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { projectEditorManager } from '../../editor/projectEditorManager.ts';
import { ConversationId, ConversationMetadata, ConversationResponse } from 'shared/types.ts';
//import { generateConversationId } from 'shared/conversationManagement.ts';
import ConversationPersistence from '../../storage/conversationPersistence.ts';

/**
 * @openapi
 * /api/v1/conversation:
 *   post:
 *     summary: Start a new conversation
 *     description: Initiates a new conversation with the AI assistant using the OrchestratorController
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - statement
 *               - startDir
 *             properties:
 *               statement:
 *                 type: string
 *                 description: The initial statement to start the conversation
 *               startDir:
 *                 type: string
 *                 description: The starting directory for the project
 *     responses:
 *       200:
 *         description: Successful response with conversation details
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
/*
export const startConversation = async (ctx: Context) => {
	let projectEditor;
	let orchestratorController;
	logger.debug('startConversation called');

	try {
		const body = await ctx.request.body.json();
		const { statement, startDir } = body;

		if (!statement) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Missing statement' };
			return;
		}

		if (!startDir) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Missing startDir' };
			return;
		}
		const conversationId: ConversationId = generateConversationId();

		if (projectEditorManager.isConversationActive(conversationId)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Conversation is already in use' };
			return;
		}

		logger.debug(`Creating ProjectEditor for dir: ${startDir}`);
		projectEditor = await projectEditorManager.getOrCreateEditor(conversationId, startDir);
		orchestratorController = projectEditor.orchestratorController;
		if (!orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		const response = await projectEditor.handleStatement(statement, conversationId);

		ctx.response.body = response;
	} catch (error) {
		logger.error(`Error in startConversation: ${error.message}`, error);
		if (error instanceof Error && 'status' in error) {
			ctx.response.status = error.status as number;
		} else {
			ctx.response.status = 500;
		}
		ctx.response.body = {
			error: 'Failed to generate response',
			details: error.message,
			type: error.name || 'UnknownError',
		};
	}
};
 */

/**
 * @openapi
 * /api/v1/conversation/{id}:
 *   post:
 *     summary: Continue an existing conversation
 *     description: Continues an existing conversation with the AI assistant using the OrchestratorController
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation to continue
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - statement
 *               - startDir
 *             properties:
 *               statement:
 *                 type: string
 *                 description: The statement to continue the conversation
 *               startDir:
 *                 type: string
 *                 description: The starting directory for the project
 *     responses:
 *       200:
 *         description: Successful response with conversation continuation
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */

export const continueConversation = async (
	{ params, request, response }: RouterContext<'/v1/conversation/:id', { id: string }>,
) => {
	logger.debug('continueConversation called');

	const { id: conversationId } = params;
	try {
		const body = await request.body.json();
		const { statement, startDir } = body;

		logger.info(
			`continueConversation for conversationId: ${conversationId}, Prompt: "${statement?.substring(0, 50)}..."`,
		);

		if (!statement) {
			logger.warn(`HandlerContinueConversation: Missing statement for conversationId: ${conversationId}`);
			response.status = 400;
			response.body = { error: 'Missing statement' };
			return;
		}

		if (!startDir) {
			logger.warn(`HandlerContinueConversation: Missing startDir for conversationId: ${conversationId}`);
			response.status = 400;
			response.body = { error: 'Missing startDir' };
			return;
		}

		if (projectEditorManager.isConversationActive(conversationId)) {
			response.status = 400;
			response.body = { error: 'Conversation is already in use' };
			return;
		}

		logger.debug(
			`HandlerContinueConversation: Creating ProjectEditor for conversationId: ${conversationId} using startDir: ${startDir}`,
		);
		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId, startDir);

		const result: ConversationResponse = await projectEditor.handleStatement(statement, conversationId);

		logger.debug(
			`HandlerContinueConversation: Response received from handleStatement for conversationId: ${conversationId}`,
		);
		response.status = 200;
		response.body = {
			conversationId: result.conversationId,
			response: result.response,
			messageMeta: result.messageMeta,
			conversationTitle: result.conversationTitle,
			conversationStats: result.conversationStats,
			tokenUsageStatement: result.tokenUsageStatement,
			tokenUsageConversation: result.tokenUsageConversation,
		};
	} catch (error) {
		logger.error(`Error in continueConversation for conversationId: ${conversationId}: ${error.message}`, error);
		response.status = 500;
		response.body = { error: 'Failed to generate response', details: error.message };
	}
};

/**
 * @openapi
 * /api/v1/conversation/{id}:
 *   get:
 *     summary: Get conversation details
 *     description: Retrieves details of a specific conversation using the OrchestratorController
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation to retrieve
 *     responses:
 *       200:
 *         description: Successful response with conversation details
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
export const getConversation = async (
	{ params, request, response }: RouterContext<'/v1/conversation/:id', { id: string }>,
) => {
	let projectEditor;
	let orchestratorController;
	try {
		const conversationId = params.id as ConversationId;
		const startDir = request.url.searchParams.get('startDir') || '';

		logger.debug(`Creating projectEditorManager`);

		logger.debug(`Creating ProjectEditor for dir: ${startDir}`);
		projectEditor = await projectEditorManager.getOrCreateEditor(conversationId, startDir);

		orchestratorController = projectEditor.orchestratorController;
		if (!orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		// orchestratorController already defined
		const interaction = orchestratorController.interactionManager.getInteraction(conversationId);

		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		response.status = 200;
		response.body = {
			id: interaction.id,
			llmProviderName: interaction.llmProviderName,
			system: interaction.baseSystem,
			model: interaction.model,
			maxTokens: interaction.maxTokens,
			temperature: interaction.temperature,
			statementTurnCount: orchestratorController.statementTurnCount,
			totalTokenUsage: orchestratorController.totalTokensTotal,
			messages: interaction.getMessages(),
		};
	} catch (error) {
		logger.error(`Error in getConversation: ${error.message}`);
		response.status = 404;
		response.body = { error: 'Conversation not found' };
	}
};

/**
 * @openapi
 * /api/v1/conversation/{id}:
 *   delete:
 *     summary: Delete a conversation
 *     description: Deletes a specific conversation
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation to delete
 *     responses:
 *       200:
 *         description: Successful response with deletion confirmation
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
export const deleteConversation = async (
	{ params, request, response }: RouterContext<'/v1/conversation/:id', { id: string }>,
	//	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	try {
		const { id: conversationId } = params;
		const startDir = request.url.searchParams.get('startDir') || '';
		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId as ConversationId, startDir);

		// orchestratorController already defined
		if (!projectEditor.orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		projectEditor.orchestratorController.interactionManager.removeInteraction(conversationId as ConversationId);

		response.status = 200;
		response.body = { message: `Conversation ${conversationId} deleted` };
	} catch (error) {
		logger.error(`Error in deleteConversation: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to delete conversation' };
	}
};

/**
 * @openapi
 * /api/v1/conversations:
 *   get:
 *     summary: List conversations
 *     description: Retrieves a list of conversations with pagination and filtering options
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter conversations starting from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter conversations up to this date
 *       - in: query
 *         name: llmProviderName
 *         schema:
 *           type: string
 *         description: Filter conversations by LLM provider name
 *     responses:
 *       200:
 *         description: Successful response with list of conversations
 *       500:
 *         description: Internal server error
 */
export const listConversations = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	const startDir = request.url.searchParams.get('startDir');
	try {
		const params = request.url.searchParams;
		const page = parseInt(params.get('page') || '1');
		const limit = parseInt(params.get('limit') || '10');
		const startDate = params.get('startDate');
		const endDate = params.get('endDate');
		const llmProviderName = params.get('llmProviderName');

		if (!startDir) {
			response.status = 400;
			response.body = { error: 'Missing startDir parameter' };
			return;
		}

		const { conversations, totalCount } = await ConversationPersistence.listConversations({
			page: page,
			limit: limit,
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			llmProviderName: llmProviderName || undefined,
			startDir: startDir,
		});

		response.status = 200;
		response.body = {
			conversations: conversations.map((conv) => ({
				id: conv.id,
				title: conv.title,
				createdAt: conv.createdAt,
				updatedAt: conv.updatedAt,
				llmProviderName: conv.llmProviderName,
				model: conv.model,
			})),
			pagination: {
				page: page,
				pageSize: limit,
				totalPages: Math.ceil(totalCount / limit),
				totalItems: totalCount,
			},
		};
	} catch (error) {
		logger.error(`Error in listConversations: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to list conversations' };
	}
};

/*
export const addMessage = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Add a message to the conversation
	response.body = { message: `Message added to conversation ${params.id}` };
};
 */

export const clearConversation = async (
	{ params, request, response }: RouterContext<'/v1/conversation/:id/clear', { id: string }>,
) => {
	try {
		const { id: conversationId } = params;
		const startDir = request.url.searchParams.get('startDir') || '';
		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId as ConversationId, startDir);

		// orchestratorController already defined
		if (!projectEditor.orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		const interaction = projectEditor.orchestratorController.interactionManager.getInteraction(
			conversationId as ConversationId,
		);
		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		interaction.clearMessages();

		response.status = 200;
		response.body = { message: `Conversation ${conversationId} cleared` };
	} catch (error) {
		logger.error(`Error in clearConversation: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to clear conversation' };
	}
};

/*
export const undoConversation = async (
	{ params, request, response }: RouterContext<'/v1/conversation/:id/undo', { id: string }>,
) => {
	try {
		const { id: conversationId } = params;
		const startDir = request.url.searchParams.get('startDir') || '';
		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId as ConversationId, startDir);

		// orchestratorController already defined
		if (!projectEditor.orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		const interaction = projectEditor.orchestratorController.interactionManager.getInteraction(conversationId as ConversationId);
		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		await interaction.revertLastPatch();

		response.status = 200;
		response.body = { message: `Last change in conversation ${conversationId} undone` };
	} catch (error) {
		logger.error(`Error in undoConversation: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to undo last change in conversation' };
	}
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
		const startDir = request.url.searchParams.get('startDir') || '';
		const body = await request.body;
		const form: FormData = await body.formData();
		const fileObj: File = form.get('file') as File;
		const filePath = fileObj.name;
		const fileSize = fileObj.size;
		const fileData = await fileObj.arrayBuffer();

		if (!filePath) {
			response.status = 400;
			response.body = { error: 'Missing filePath in request body' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId as ConversationId, startDir);

		// orchestratorController already defined
		const interaction = orchestratorController.getInteraction(conversationId as ConversationId);

		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		await interaction.addFile(filePath, new Uint8Array(fileData));

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
		const startDir = request.url.searchParams.get('startDir') || '';

		if (!fileId) {
			response.status = 400;
			response.body = { error: 'Missing fileId in request parameters' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId as ConversationId, startDir);

		// orchestratorController already defined
		const interaction = orchestratorController.getInteraction(conversationId as ConversationId);

		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		await interaction.removeFile(fileId);

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
		const startDir = request.url.searchParams.get('startDir') || '';

		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId as ConversationId, startDir);

		// orchestratorController already defined
		const interaction = orchestratorController.getInteraction(conversationId as ConversationId);

		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		const files = interaction.listFiles();

		response.status = 200;
		response.body = { conversationId, files };
	} catch (error) {
		logger.error(`Error in listFiles: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to list files in conversation' };
	}
};
 */
