import { stub } from '../deps.ts';
import ProjectEditor from '../../src/editor/projectEditor.ts';
import OrchestratorController from '../../src/controllers/orchestratorController.ts';
import LLMConversationInteraction from '../../src/llms/interactions/conversationInteraction.ts';
import { ConversationId, ConversationResponse } from 'shared/types.ts';

export function makeProjectEditorStub(projectEditor: ProjectEditor) {
	const initStub = stub(projectEditor, 'init', async () => projectEditor);
	/*
	const initConversationStub = stub(
		projectEditor,
		'initConversation',
		() => ({} as LLMConversationInteraction),
	);
	const handleStatementStub = stub(projectEditor, 'handleStatement', async (
		statement: string,
		conversationId: ConversationId,
	): Promise<ConversationResponse> => ({
		conversationId: 'test-id',
		response: { answerContent: [{ type: 'text', text: 'Test response' }] },
		messageMeta: {},
		conversationTitle: 'Test Conversation',
		conversationStats: { statementCount: 1, turnCount: 1, totalTurnCount: 1 },
		tokenUsageStatement: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
		tokenUsageConversation: { inputTokensTotal: 10, outputTokensTotal: 20, totalTokensTotal: 30 },
	}));
 */

	return {
		projectEditor,
		initStub,
		//initConversationStub,
		//handleStatementStub,
	};
}

export function makeOrchestratorControllerStub(orchestratorController: OrchestratorController) {
	/*
	const initStub = stub(orchestratorController, 'init', async () => {});
	const handleStatementStub = stub(orchestratorController, 'handleStatement', async (
		statement: string,
		conversationId: ConversationId,
	): Promise<ConversationResponse> => ({
		conversationId: 'test-id',
		response: { answerContent: [{ type: 'text', text: 'Test response' }] },
		messageMeta: {},
		conversationTitle: 'Test Conversation',
		conversationStats: { statementCount: 1, turnCount: 1, totalTurnCount: 1 },
		tokenUsageStatement: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
		tokenUsageConversation: { inputTokensTotal: 10, outputTokensTotal: 20, totalTokensTotal: 30 },
	}));
	const initializePrimaryInteractionStub = stub(orchestratorController, 'initializePrimaryInteraction', async () => ({
		id: 'test-id',
		title: 'Test Conversation',
		statementCount: 1,
		turnCount: 1,
		totalTurnCount: 1,
	}));
	const getInteractionStub = stub(orchestratorController, 'getInteraction', () => ({
		id: 'test-id',
		title: 'Test Conversation',
		llmProviderName: 'test-provider',
		baseSystem: 'test-system',
		model: 'test-model',
		maxTokens: 1000,
		temperature: 0.7,
		turnCount: 1,
		getTotalTokensTotal: () => 100,
		getMessages: () => [],
		addFile: async () => {},
		removeFile: async () => {},
		listFiles: () => [],
		clearHistory: async () => {},
		undoLastChange: async () => {},
	}));
	const deleteInteractionStub = stub(orchestratorController, 'deleteInteraction', async () => {});
	const createChildInteractionStub = stub(
		orchestratorController,
		'createChildInteraction',
		async () => 'child-test-id',
	);
	const getInteractionResultStub = stub(
		orchestratorController,
		'getInteractionResult',
		async () => ({ result: 'test result' }),
	);
	const cleanupChildInteractionsStub = stub(orchestratorController, 'cleanupChildInteractions', async () => {});
	const manageAgentTasksStub = stub(orchestratorController, 'manageAgentTasks', async () => {});
 */

	return {
		orchestratorController,
		//initStub,
		//handleStatementStub,
		//initializePrimaryInteractionStub,
		//getInteractionStub,
		//deleteInteractionStub,
		//createChildInteractionStub,
		//getInteractionResultStub,
		//cleanupChildInteractionsStub,
		//manageAgentTasksStub,
	};
}
