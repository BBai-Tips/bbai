import { stub } from '../deps.ts';
import ProjectEditor from '../../src/editor/projectEditor.ts';
import OrchestratorController from '../../src/controllers/orchestratorController.ts';
//import LLMConversationInteraction from '../../src/llms/interactions/conversationInteraction.ts';
//import type { LLMSpeakWithResponse } from '../../src/types.ts';
//import { ConversationId, ConversationResponse } from 'shared/types.ts';

/*
 *  To use these new stub factories in your tests, you would do something like this:
 *
 *  ```typescript
 *  const stubMaker = makeOrchestratorControllerStub(orchestratorController);
 *
 *  // Stub only the methods you need for a particular test
 *  stubMaker.generateConversationTitleStub(() => Promise.resolve('Test Title'));
 *  stubMaker.stageAndCommitAfterPatchingStub(() => Promise.resolve());
 *
 *  // You can provide different implementations in different tests
 *  stubMaker.revertLastPatchStub(() => {
 *    // Custom implementation for this specific test
 *    return Promise.resolve();
 *  });
 *  ```
 */

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
		conversationStats: { statementCount: 1, statementTurnCount: 1, conversationTurnCount: 1 },
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
	const createStub = <T extends keyof OrchestratorController>(methodName: T) => {
		return (implementation?: OrchestratorController[T]) => {
			return stub(orchestratorController, methodName, implementation as never);
		};
	};
	const generateConversationTitleStub = createStub('generateConversationTitle');
	const stageAndCommitAfterPatchingStub = createStub('stageAndCommitAfterPatching');
	const revertLastPatchStub = createStub('revertLastPatch');
	const logPatchAndCommitStub = createStub('logPatchAndCommit');
	const saveInitialConversationWithResponseStub = createStub('saveInitialConversationWithResponse');
	const saveConversationAfterStatementStub = createStub('saveConversationAfterStatement');
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
		conversationStats: { statementCount: 1, statementTurnCount: 1, conversationTurnCount: 1 },
		tokenUsageStatement: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
		tokenUsageConversation: { inputTokensTotal: 10, outputTokensTotal: 20, totalTokensTotal: 30 },
	}));
	const initializePrimaryInteractionStub = stub(orchestratorController, 'initializePrimaryInteraction', async () => ({
		id: 'test-id',
		title: 'Test Conversation',
		statementCount: 1,
		statementTurnCount: 1,
		conversationTurnCount: 1,
	}));
	const getInteractionStub = stub(orchestratorController, 'getInteraction', () => ({
		id: 'test-id',
		title: 'Test Conversation',
		llmProviderName: 'test-provider',
		baseSystem: 'test-system',
		model: 'test-model',
		maxTokens: 1000,
		temperature: 0.7,
		statementTurnCount: 1,
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
		generateConversationTitleStub,
		stageAndCommitAfterPatchingStub,
		revertLastPatchStub,
		logPatchAndCommitStub,
		saveInitialConversationWithResponseStub,
		saveConversationAfterStatementStub,
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
