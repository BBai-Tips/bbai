import { assert, assertEquals, assertThrows } from '../../../deps.ts';
import { join } from '@std/path';
import { existsSync } from '@std/fs';

import LLMConversationInteraction from '../../../../src/llms/interactions/conversationInteraction.ts';
import { LLMToolRewriteFile } from '../../../../src/llms/tools/rewriteFileTool.ts';
import ProjectEditor from '../../../../src/editor/projectEditor.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';

const projectEditor = await getProjectEditor(Deno.makeTempDirSync());
const testProjectRoot = projectEditor.projectRoot;
console.log('Project editor root:', testProjectRoot);

// Ensure all file paths are relative to testProjectRoot
const getTestFilePath = (filename: string) => join(testProjectRoot, filename);

async function getProjectEditor(testProjectRoot: string): Promise<ProjectEditor> {
	await GitUtils.initGit(testProjectRoot);
	return await new ProjectEditor(testProjectRoot).init();
}

// Add this function at the beginning of the test file, after the imports
async function createTestInteraction(conversationId: string): Promise<LLMConversationInteraction> {
	//const orchestratorController = await new OrchestratorController(projectEditor).init();
	//orchestratorController.primaryInteractionId = 'test-conversation';
	//const interaction = await orchestratorController.initializePrimaryInteraction('test-conversation');
	const interaction = await projectEditor.initConversation(conversationId);
	return interaction as LLMConversationInteraction;
}
const interaction = await createTestInteraction('test-conversation');

Deno.test({
	name: 'Rewrite File Tool - rewrite existing file',
	async fn() {
		const tool = new LLMToolRewriteFile();

		// Create a test file
		const testFile = 'test.txt';
		const testFilePath = getTestFilePath(testFile);
		await Deno.writeTextFile(testFilePath, 'Original content');

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'rewrite_file',
			toolInput: {
				filePath: testFile,
				content: 'New content',
			},
		};

		const result = await tool.runTool(interaction, toolUse, projectEditor);

		assert(result.toolResponse.includes(`Contents written successfully to file: ${testFile}`));

		const newContent = await Deno.readTextFile(testFilePath);
		assertEquals(newContent, 'New content');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Rewrite File Tool - create new file',
	async fn() {
		const tool = new LLMToolRewriteFile();

		// Create a test file
		const testFile = 'new-test.txt';
		const testFilePath = getTestFilePath(testFile);

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'rewrite_file',
			toolInput: {
				filePath: testFile,
				content: 'New file content',
			},
		};

		const result = await tool.runTool(interaction, toolUse, projectEditor);

		assert(result.toolResponse.includes(`File created and contents written successfully to file: ${testFile}`));

		assert(await Deno.stat(testFilePath));

		const newContent = await Deno.readTextFile(testFilePath);
		assertEquals(newContent, 'New file content');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

/* 
Deno.test({
	name: 'Rewrite File Tool - throw error for file outside project',
	async fn() {
		const tool = new LLMToolRewriteFile();

		// Create a test file
		const testFile = '/tmp/outside_project.txt';
		//const testFilePath = '/tmp/outside_project.txt';

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'rewrite_file',
			toolInput: {
				filePath: testFile,
				content: 'New content',
			},
		};

		assertThrows(
			async () => await tool.runTool(interaction, toolUse, projectEditor),
			Error,
			`Access denied: ${testFile} is outside the project directory`,
		);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
 */
