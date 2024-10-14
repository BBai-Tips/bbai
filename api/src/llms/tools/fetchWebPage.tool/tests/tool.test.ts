import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';

import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

// Type guard function
function isFetchWebPageResponse(
	response: unknown,
): response is {
	data: {
		url: string;
		html: string;
	};
} {
	return (
		typeof response === 'object' &&
		response !== null &&
		'data' in response &&
		typeof (response as any).data === 'object' &&
		'url' in (response as any).data &&
		typeof (response as any).data.url === 'string' &&
		'html' in (response as any).data &&
		typeof (response as any).data.html === 'string'
	);
}

Deno.test({
	name: 'FetchWebPageTool - successful fetch',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_page');
			assert(tool, 'Failed to get tool');

			const url = 'https://google.com';
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'fetch_web_page',
				toolInput: {
					url,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('successful fetch - bbaiResponse:', result.bbaiResponse);
			// console.log('successful fetch - toolResponse:', result.toolResponse);
			// console.log('successful fetch - toolResults:', result.toolResults);

			assert(
				result.bbaiResponse && typeof result.bbaiResponse === 'object',
				'bbaiResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'string');

			assert(
				isFetchWebPageResponse(result.bbaiResponse),
				'bbaiResponse should have the correct structure for Tool',
			);

			if (isFetchWebPageResponse(result.bbaiResponse)) {
				assert(result.bbaiResponse.data.html.startsWith('<style>'), 'HTML should start with <style>');
				assertEquals(result.bbaiResponse.data.url, 'https://google.com', 'URL should be google.com');
			} else {
				assert(false, 'bbaiResponse does not have the expected structure for MultiModelQueryTool');
			}

			assertStringIncludes(result.toolResponse, `Successfully fetched content from ${url}`);

			const content = result.toolResults as string;
			assertStringIncludes(content, 'Google');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FetchWebPageTool - invalid URL',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_page');
			assert(tool, 'Failed to get tool');
			try {
				const url = 'https://googlezzz.com';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'fetch_web_page',
					toolInput: {
						url,
					},
				};

				const conversation = await projectEditor.initConversation('test-conversation-id');
				await tool.runTool(conversation, toolUse, projectEditor);
			} catch (error) {
				assertStringIncludes(error.message, 'Failed to fetch web page');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FetchWebPageTool - non-existent page',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_page');
			assert(tool, 'Failed to get tool');
			try {
				const url = 'https://google.com/ttt';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'fetch_web_page',
					toolInput: {
						url,
					},
				};

				const conversation = await projectEditor.initConversation('test-conversation-id');
				await tool.runTool(conversation, toolUse, projectEditor);
			} catch (error) {
				assertStringIncludes(error.message, 'Failed to fetch web page');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
