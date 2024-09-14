import { assertEquals, assertStringIncludes } from '../../../deps.ts';

import LLMToolFetchWebPage from '../../../../src/llms/tools/fetchWebPageTool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, withTestProject } from '../../../lib/testSetup.ts';

Deno.test({
	name: 'FetchWebPageTool - successful fetch',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const tool = new LLMToolFetchWebPage();

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

			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.bbaiResponse, 'string');
			assertEquals(typeof result.toolResults, 'string');

			assertStringIncludes(result.toolResponse, `Successfully fetched content from ${url}`);
			assertStringIncludes(result.bbaiResponse, `I've retrieved the content from ${url}`);

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

			const tool = new LLMToolFetchWebPage();
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

			const tool = new LLMToolFetchWebPage();
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
