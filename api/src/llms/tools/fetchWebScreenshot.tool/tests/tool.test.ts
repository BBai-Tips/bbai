import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';

import LLMToolFetchWebScreenshot from '../tool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, withTestProject } from 'api/tests/testSetup.ts';

Deno.test({
	name: 'LLMToolFetchWebScreenshot - successful fetch',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const tool = new LLMToolFetchWebScreenshot();

			const url = 'https://google.com';
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'fetch_web_screenshot',
				toolInput: {
					url,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			//console.log(`TEST DEBUG: bbaiResponse: ${result.bbaiResponse}`);
			//console.log(`TEST DEBUG: toolResponse: ${result.toolResponse}`);
			//console.log(`TEST DEBUG: toolResults: ${JSON.stringify(result.toolResults, null, 2)}`);

			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.bbaiResponse, 'string');

			assertStringIncludes(result.toolResponse, `Successfully fetched screenshot from ${url}`);
			assertStringIncludes(
				result.bbaiResponse,
				`I've captured a screenshot of ${url}. The image data is available as a base64-encoded string`,
			);

			// Check toolResults
			//assertEquals(typeof result.toolResults, 'object');
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 1, 'toolResults should have 1 element');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'image', 'First result should be of type image');
			assertStringIncludes(firstResult.source.type, 'base64', 'Image source should be of type base64');
			assertStringIncludes(
				firstResult.source.media_type,
				'image/png',
				'Image source should have media_type image/png',
			);
			// Check if the result is a valid base64 string
			const base64Regex = /^[A-Za-z0-9+/=]+$/;
			assertEquals(
				base64Regex.test(firstResult.source.data),
				true,
				'Screenshot should be a valid base64 string',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolFetchWebScreenshot - invalid URL',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const tool = new LLMToolFetchWebScreenshot();
			try {
				const url = 'https://googlezzz.com';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'fetch_web_screenshot',
					toolInput: {
						url,
					},
				};

				const conversation = await projectEditor.initConversation('test-conversation-id');
				await tool.runTool(conversation, toolUse, projectEditor);
			} catch (error) {
				assertStringIncludes(error.message, 'Failed to fetch web page screenshot');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
