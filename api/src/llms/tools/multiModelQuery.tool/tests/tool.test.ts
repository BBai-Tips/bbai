import { assert, assertEquals, assertStringIncludes, stub } from 'api/tests/deps.ts';
import MultiModelQueryTool from '../tool.ts';
import type { ModelProvider } from '../tool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

// Mock API responses
const mockAnthropicResponse = 'This is a mock response from Anthropic.';
const mockOpenAIResponse = 'This is a mock response from OpenAI.';

export function makeMultiQueryProviderStub(provider: ModelProvider) {
	const createStub = <T extends keyof ModelProvider>(methodName: T) => {
		return (implementation?: ModelProvider[T]) => {
			return stub(provider, methodName, implementation as never);
		};
	};
	const providerQueryStub = createStub('query');

	return {
		providerQueryStub,
	};
}

const toolConfig = {
	anthropicApiKey: 'sk-ant-xxxx',
	openaiApiKey: 'sk-proj-xxxx',
	models: [
		'claude-3-5-sonnet-20240620',
		'claude-3-haiku-20240307',
		'gpt-4',
		'gpt-4o',
	],
};

// Type guard function
function isMultiModelQueryResponse(
	response: unknown,
): response is {
	data: {
		querySuccess: Array<{ modelIdentifier: string; answer: string }>;
		queryError: Array<{ modelIdentifier: string; error: string }>;
	};
} {
	return (
		typeof response === 'object' &&
		response !== null &&
		'data' in response &&
		typeof (response as any).data === 'object' &&
		'querySuccess' in (response as any).data &&
		Array.isArray((response as any).data.querySuccess) &&
		'queryError' in (response as any).data &&
		Array.isArray((response as any).data.queryError)
	);
}

Deno.test({
	name: 'MultiModelQueryTool - successful query',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'multi_model_query', toolConfig);
			const tool = await toolManager.getTool('multi_model_query') as MultiModelQueryTool;
			assert(tool, 'Failed to get tool');

			const multiQueryProviderAnthropicStubMaker = makeMultiQueryProviderStub(tool.providers.anthropic);
			const queryProviderAnthropicStub = multiQueryProviderAnthropicStubMaker.providerQueryStub(() =>
				Promise.resolve(mockAnthropicResponse)
			);
			const multiQueryProviderOpenAIStubMaker = makeMultiQueryProviderStub(tool.providers.openai);
			const queryProviderOpenAIStub = multiQueryProviderOpenAIStubMaker.providerQueryStub(() =>
				Promise.resolve(mockOpenAIResponse)
			);

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'multiModelQuery',
					toolInput: {
						query: 'What is the capital of France?',
						// 						models: ['anthropic:claude-2', 'openai:gpt-3.5-turbo'],
						models: ['claude-3-5-sonnet-20240620', 'gpt-4'],
					},
				};

				const conversation = await projectEditor.initConversation('test-conversation-id');
				const result = await tool.runTool(conversation, toolUse, projectEditor);
				// console.log('successful query - bbaiResponse:', result.bbaiResponse);
				// console.log('successful query - toolResponse:', result.toolResponse);
				// console.log('successful query - toolResults:', result.toolResults);

				assert(
					result.bbaiResponse && typeof result.bbaiResponse === 'object',
					'bbaiResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isMultiModelQueryResponse(result.bbaiResponse),
					'bbaiResponse should have the correct structure for Tool',
				);

				if (isMultiModelQueryResponse(result.bbaiResponse)) {
					assertEquals(
						result.bbaiResponse.data.querySuccess.length,
						2,
						'Should have 2 successful query results',
					);
					const anthropicResult = result.bbaiResponse.data.querySuccess.find((r) =>
						r.modelIdentifier === 'anthropic/claude-3-5-sonnet-20240620'
					);
					const openaiResult = result.bbaiResponse.data.querySuccess.find((r) =>
						r.modelIdentifier === 'openai/gpt-4'
					);
					assert(anthropicResult, 'Should have a result for Anthropic model');
					assert(openaiResult, 'Should have a result for OpenAI model');
					assertEquals(anthropicResult.answer, mockAnthropicResponse, 'Anthropic response should match mock');
					assertEquals(openaiResult.answer, mockOpenAIResponse, 'OpenAI response should match mock');
					assertEquals(result.bbaiResponse.data.queryError.length, 0, 'Should have no query errors');
				} else {
					assert(false, 'bbaiResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(
					result.toolResponse,
					'Queried models:\n- anthropic/claude-3-5-sonnet-20240620\n- openai/gpt-4',
				);

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, 'Model: anthropic/claude-3-5-sonnet-20240620');
				assertStringIncludes(firstResult.text, mockAnthropicResponse);

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(secondResult.text, 'Model: openai/gpt-4');
				assertStringIncludes(secondResult.text, mockOpenAIResponse);
			} finally {
				queryProviderAnthropicStub.restore();
				queryProviderOpenAIStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MultiModelQueryTool - invalid provider',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'multi_model_query', toolConfig);
			const tool = await toolManager.getTool('multi_model_query') as MultiModelQueryTool;
			assert(tool, 'Failed to get tool');

			const multiQueryProviderAnthropicStubMaker = makeMultiQueryProviderStub(tool.providers.anthropic);
			const queryProviderAnthropicStub = multiQueryProviderAnthropicStubMaker.providerQueryStub(() =>
				Promise.resolve(mockAnthropicResponse)
			);
			const multiQueryProviderOpenAIStubMaker = makeMultiQueryProviderStub(tool.providers.openai);
			const queryProviderOpenAIStub = multiQueryProviderOpenAIStubMaker.providerQueryStub(() =>
				Promise.resolve(mockOpenAIResponse)
			);

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'multiModelQuery',
					toolInput: {
						query: 'What is the capital of France?',
						//models: ['invalid:model'],
						models: ['invalid-model'],
					},
				};

				const conversation = await projectEditor.initConversation('test-conversation-id');
				const result = await tool.runTool(conversation, toolUse, projectEditor);
				// console.log('invalid provider - bbaiResponse:', result.bbaiResponse);
				// console.log('invalid provider - toolResponse:', result.toolResponse);
				// console.log('invalid provider - toolResults:', result.toolResults);

				assert(
					result.bbaiResponse && typeof result.bbaiResponse === 'object',
					'bbaiResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isMultiModelQueryResponse(result.bbaiResponse),
					'bbaiResponse should have the correct structure for Tool',
				);

				if (isMultiModelQueryResponse(result.bbaiResponse)) {
					assertEquals(
						result.bbaiResponse.data.queryError.length,
						1,
						'Should have 1 error results',
					);
					const errorResult = result.bbaiResponse.data.queryError.find((r) =>
						r.modelIdentifier === 'undefined/invalid-model'
					);

					assert(errorResult, 'Should have an error result');
					assertEquals(
						errorResult.error,
						'Unsupported provider: undefined',
						'Error response should be Unsupported provider',
					);

					assertEquals(result.bbaiResponse.data.querySuccess.length, 0, 'Should have no successful queries');
				} else {
					assert(false, 'bbaiResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(
					result.toolResponse,
					'No models queried.\nFailed to query models:\n- undefined/invalid-model: Unsupported provider: undefined',
				);

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					'Error querying undefined/invalid-model: Unsupported provider: undefined',
				);
			} finally {
				queryProviderAnthropicStub.restore();
				queryProviderOpenAIStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MultiModelQueryTool - API error handling',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'multi_model_query', toolConfig);
			const tool = await toolManager.getTool('multi_model_query') as MultiModelQueryTool;
			assert(tool, 'Failed to get tool');

			const multiQueryProviderAnthropicStubMaker = makeMultiQueryProviderStub(tool.providers.anthropic);
			const queryProviderAnthropicStub = multiQueryProviderAnthropicStubMaker.providerQueryStub(() =>
				Promise.reject(new Error('Anthropic API error'))
			);
			const multiQueryProviderOpenAIStubMaker = makeMultiQueryProviderStub(tool.providers.openai);
			const queryProviderOpenAIStub = multiQueryProviderOpenAIStubMaker.providerQueryStub(() =>
				Promise.reject(new Error('OpenAI API error'))
			);

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolName: 'multiModelQuery',
					toolUseId: 'test-id',
					toolInput: {
						query: 'What is the capital of France?',
						models: ['claude-3-5-sonnet-20240620', 'gpt-4'],
					},
				};

				const conversation = await projectEditor.initConversation('test-conversation-id');
				const result = await tool.runTool(conversation, toolUse, projectEditor);
				//console.log('API error handling - bbaiResponse:', result.bbaiResponse);
				//console.log('API error handling - toolResponse:', result.toolResponse);
				//console.log('API error handling - toolResults:', result.toolResults);

				assert(
					result.bbaiResponse && typeof result.bbaiResponse === 'object',
					'bbaiResponse should be an object',
				);

				assert(
					isMultiModelQueryResponse(result.bbaiResponse),
					'bbaiResponse should have the correct structure for Tool',
				);

				if (isMultiModelQueryResponse(result.bbaiResponse)) {
					assertEquals(
						result.bbaiResponse.data.queryError.length,
						2,
						'Should have 2 error results',
					);
					const anthropicResult = result.bbaiResponse.data.queryError.find((r) =>
						r.modelIdentifier === 'anthropic/claude-3-5-sonnet-20240620'
					);
					const openaiResult = result.bbaiResponse.data.queryError.find((r) =>
						r.modelIdentifier === 'openai/gpt-4'
					);
					assert(anthropicResult, 'Should have a result for Anthropic model');
					assert(openaiResult, 'Should have a result for OpenAI model');

					assertEquals(
						anthropicResult.error,
						'Anthropic API error',
						'Anthropic response should match API error',
					);
					assertEquals(openaiResult.error, 'OpenAI API error', 'OpenAI response should match API error');

					assertEquals(result.bbaiResponse.data.querySuccess.length, 0, 'Should have no successful queries');
				} else {
					assert(false, 'bbaiResponse does not have the expected structure for Tool');
				}

				// 				assertStringIncludes(
				// 					result.bbaiResponse,
				// 					'BBai failed to query models:\n- anthropic/claude-3-5-sonnet-20240620: Anthropic API error\n- openai/gpt-4: OpenAI API error. You can review their responses in the output.',
				// 				);
				assertStringIncludes(
					result.toolResponse,
					'No models queried.\nFailed to query models:\n- anthropic/claude-3-5-sonnet-20240620: Anthropic API error\n- openai/gpt-4: OpenAI API error',
				);

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					'Error querying anthropic/claude-3-5-sonnet-20240620: Anthropic API error',
				);

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(secondResult.text, 'Error querying openai/gpt-4: OpenAI API error');
			} finally {
				queryProviderAnthropicStub.restore();
				queryProviderOpenAIStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
