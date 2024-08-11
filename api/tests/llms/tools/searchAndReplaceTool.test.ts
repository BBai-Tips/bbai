import { assert, assertEquals, assertRejects } from '../../deps.ts';
import { join } from '@std/path';

import { LLMToolSearchAndReplace } from '../../../src/llms/tools/searchAndReplaceTool.ts';
import ProjectEditor from '../../../src/editor/projectEditor.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';

const projectEditor = await getProjectEditor(Deno.makeTempDirSync());
const testProjectRoot = projectEditor.projectRoot;
console.log('Project editor root:', testProjectRoot);

// Ensure all file paths are relative to testProjectRoot
const getTestFilePath = (filename: string) => join(testProjectRoot, filename);

async function getProjectEditor(testProjectRoot: string): Promise<ProjectEditor> {
	await GitUtils.initGit(testProjectRoot);
	return await new ProjectEditor('test-conversation-id', testProjectRoot).init();
}

/*
function cleanupTestDirectory() {
	for (const entry of Deno.readDirSync(testProjectRoot)) {
		Deno.removeSync(join(testProjectRoot, entry.name), { recursive: true });
	}
}
 */

Deno.test({
	name: 'SearchAndReplaceTool - Basic functionality',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();

		// Create a test file
		const testFile = 'test.txt';
		const testFilePath = getTestFilePath(testFile);
		await Deno.writeTextFile(testFilePath, 'Hello, world!');

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_and_replace',
			toolInput: {
				filePath: testFile,
				operations: [
					{ search: 'world', replace: 'Deno' },
				],
			},
		};

		const result = await tool.runTool(toolUse, projectEditor);

		assert(result.toolResponse.includes('Search and replace operations applied successfully'));

		const updatedContent = await Deno.readTextFile(testFilePath);
		assertEquals(updatedContent, 'Hello, Deno!');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Multiple operations on new file',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();

		const newFile = 'multi_op_test.txt';
		const newFilePath = getTestFilePath(newFile);
		console.log(`testing with file: ${newFilePath}`);

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_and_replace',
			toolInput: {
				filePath: newFile,
				operations: [
					{ search: '', replace: 'Hello, world!' },
					{ search: 'world', replace: 'Deno' },
					{ search: 'Hello', replace: 'Greetings' },
				],
				createIfMissing: true,
			},
		};

		const result = await tool.runTool(toolUse, projectEditor);
		console.log(`created file: ${newFilePath}`);

		assertEquals(
			result.toolResponse.includes('File created and search and replace operations applied successfully'),
			true,
		);

		const fileContent = await Deno.readTextFile(newFilePath);
		assertEquals(fileContent, 'Greetings, Deno!');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Attempt to create file outside project root',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();

		const testFile = '../outside_project.txt';

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_and_replace',
			toolInput: {
				filePath: testFile,
				operations: [
					{ search: '', replace: 'This should not be created' },
				],
				createIfMissing: true,
			},
		};

		await assertRejects(
			async () => await tool.runTool(toolUse, projectEditor),
			Error,
			'Access denied:',
		);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Empty operations array',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();

		const testFile = 'empty_ops_test.txt';
		const testFilePath = join(testProjectRoot, testFile);
		await Deno.writeTextFile(testFilePath, 'Original content');

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_and_replace',
			toolInput: {
				filePath: testFile,
				operations: [],
			},
		};

		await assertRejects(
			async () => await tool.runTool(toolUse, projectEditor),
			Error,
			'No changes were made to the file',
		);

		const fileContent = await Deno.readTextFile(testFilePath);
		assertEquals(fileContent, 'Original content');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Unicode characters',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();

		const testFile = 'unicode_test.txt';
		const testFilePath = join(testProjectRoot, testFile);
		await Deno.writeTextFile(testFilePath, 'Hello, 世界!');

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_and_replace',
			toolInput: {
				filePath: testFile,
				operations: [
					{ search: '世界', replace: '🌍' },
				],
			},
		};

		const result = await tool.runTool(toolUse, projectEditor);

		assertEquals(result.toolResponse.includes('Search and replace operations applied successfully'), true);

		const fileContent = await Deno.readTextFile(testFilePath);
		assertEquals(fileContent, 'Hello, 🌍!');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: "SearchAndReplaceTool - Create new file if it doesn't exist",
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();

		const newFile = 'new_test.txt';
		const newFilePath = getTestFilePath(newFile);

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_and_replace',
			toolInput: {
				filePath: newFile,
				operations: [
					{ search: '', replace: 'Hello, new file!' },
				],
				createIfMissing: true,
			},
		};

		const result = await tool.runTool(toolUse, projectEditor);

		assertEquals(
			result.toolResponse.includes('File created and search and replace operations applied successfully'),
			true,
		);

		const fileContent = await Deno.readTextFile(newFilePath);
		assertEquals(fileContent, 'Hello, new file!');

		// Verify that the file is added to patchedFiles and patchContents
		// [TODO] the patchedFiles and patchedContents get cleared after saving to conversation
		// So change assertions to check the patched files in persisted conversation
		//assert(projectEditor.patchedFiles.has(newFile));
		//assert(projectEditor.patchContents.has(newFile));
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - No changes when search string not found',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();

		const testFile = 'test.txt';
		const testFilePath = join(testProjectRoot, testFile);
		await Deno.writeTextFile(testFilePath, 'Hello, world!');

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_and_replace',
			toolInput: {
				filePath: testFile,
				operations: [
					{ search: 'Deno', replace: 'TypeScript' },
				],
			},
		};

		await assertRejects(
			async () => await tool.runTool(toolUse, projectEditor),
			Error,
			'No changes were made to the file',
		);

		const updatedContent = await Deno.readTextFile(testFilePath);
		assertEquals(updatedContent, 'Hello, world!');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

//cleanupTestDirectory();
