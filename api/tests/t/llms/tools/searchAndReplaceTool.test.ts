import { assert, assertEquals, assertRejects, assertStringIncludes } from '../../../deps.ts';
import { join } from '@std/path';

//import OrchestratorController from '../../../../src/controllers/orchestratorController.ts';
import LLMConversationInteraction from '../../../../src/llms/interactions/conversationInteraction.ts';
import LLMToolSearchAndReplace from '../../../../src/llms/tools/searchAndReplaceTool.ts';
import ProjectEditor from '../../../../src/editor/projectEditor.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';
import { makeOrchestratorControllerStub } from '../../../lib/stubs.ts';

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

//const projectEditorStubMaker = makeProjectEditorStub(projectEditor);
const orchestratorControllerStubMaker = makeOrchestratorControllerStub(projectEditor.orchestratorController);

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
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
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

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			//console.log(`TEST DEBUG: bbaiResponse: ${result.bbaiResponse}`);
			//console.log(`TEST DEBUG: toolResponse: ${result.toolResponse}`);
			//console.log(`TEST DEBUG: toolResults: ${JSON.stringify(result.toolResults, null, 2)}`);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Search and replace operations applied to file: test.txt');
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'Operation 1 completed successfully');

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'Hello, Deno!');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Multiple operations on new file',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
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

			const result = await tool.runTool(interaction, toolUse, projectEditor);
			console.log(`created file: ${newFilePath}`);

			assertStringIncludes(
				result.bbaiResponse,
				'File created and search and replace operations applied to file: multi_op_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully\n✅   Operation 2: Operation 2 completed successfully\n✅   Operation 3: Operation 3 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 4, 'toolResults should have 4 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'File created and search and replace operations applied to file: multi_op_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			for (let i = 1; i <= 3; i++) {
				const operationResult = result.toolResults[i];
				assert(operationResult.type === 'text', `Result ${i} should be of type text`);
				assertStringIncludes(operationResult.text, `Operation ${i} completed successfully`);
			}

			const fileContent = await Deno.readTextFile(newFilePath);
			assertEquals(fileContent, 'Greetings, Deno!');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Attempt to create file outside project root',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
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
				async () => await tool.runTool(interaction, toolUse, projectEditor),
				Error,
				'Access denied:',
			);
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Empty operations array',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
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
				async () => await tool.runTool(interaction, toolUse, projectEditor),
				Error,
				'No changes were made to the file',
			);

			const fileContent = await Deno.readTextFile(testFilePath);
			assertEquals(fileContent, 'Original content');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Unicode characters',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
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

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: unicode_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Search and replace operations applied to file: unicode_test.txt');
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'Operation 1 completed successfully');

			const fileContent = await Deno.readTextFile(testFilePath);
			assertEquals(fileContent, 'Hello, 🌍!');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: "SearchAndReplaceTool - Create new file if it doesn't exist",
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
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

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nFile created and search and replace operations applied to file: new_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'File created and search and replace operations applied to file: new_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'Operation 1 completed successfully');

			const fileContent = await Deno.readTextFile(newFilePath);
			assertEquals(fileContent, 'Hello, new file!');

			// Verify that the file is added to patchedFiles and patchContents
			// [TODO] the patchedFiles and patchedContents get cleared after saving to conversation
			// So change assertions to check the patched files in persisted conversation
			//assert(projectEditor.patchedFiles.has(newFile));
			//assert(projectEditor.patchContents.has(newFile));
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - No changes when search string not found',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
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
				async () => await tool.runTool(interaction, toolUse, projectEditor),
				Error,
				'No changes were made to the file',
			);

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'Hello, world!');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Multiline search and replace',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
			const testFile = 'multiline_test.txt';
			const testFilePath = getTestFilePath(testFile);
			await Deno.writeTextFile(testFilePath, 'function test() {\n\tconsole.log("Hello");\n}');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_and_replace',
				toolInput: {
					filePath: testFile,
					operations: [
						{
							search: 'function test() {\n\tconsole.log("Hello");\n}',
							replace: 'function newTest() {\n\tconsole.log("Hello, World!");\n}',
						},
					],
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: multiline_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Search and replace operations applied to file: multiline_test.txt');
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'Operation 1 completed successfully');

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'function newTest() {\n\tconsole.log("Hello, World!");\n}');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Replace with empty string',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
			const testFile = 'empty_replace_test.txt';
			const testFilePath = getTestFilePath(testFile);
			await Deno.writeTextFile(testFilePath, 'Hello, world!');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_and_replace',
				toolInput: {
					filePath: testFile,
					operations: [
						{ search: 'world', replace: '' },
					],
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: empty_replace_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'Search and replace operations applied to file: empty_replace_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'Operation 1 completed successfully');

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'Hello, !');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Case sensitive search (default)',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
			const testFile = 'case_sensitive_test.txt';
			const testFilePath = getTestFilePath(testFile);
			await Deno.writeTextFile(testFilePath, 'Hello, World! hello, world!');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_and_replace',
				toolInput: {
					filePath: testFile,
					operations: [
						{ search: 'World', replace: 'Deno' },
					],
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: case_sensitive_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'Search and replace operations applied to file: case_sensitive_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'Operation 1 completed successfully');

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'Hello, Deno! hello, world!');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Case insensitive search',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
			const testFile = 'case_insensitive_test.txt';
			const testFilePath = getTestFilePath(testFile);
			await Deno.writeTextFile(testFilePath, 'Hello, World! hello, world!');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_and_replace',
				toolInput: {
					filePath: testFile,
					operations: [
						{ search: 'world', replace: 'Deno', replaceAll: true, caseSensitive: false },
					],
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: case_insensitive_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'Search and replace operations applied to file: case_insensitive_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'Operation 1 completed successfully');

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'Hello, Deno! hello, Deno!');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Multiple non-overlapping replacements',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
			const testFile = 'multiple_replace_test.txt';
			const testFilePath = getTestFilePath(testFile);
			await Deno.writeTextFile(testFilePath, 'The quick brown fox jumps over the lazy dog');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_and_replace',
				toolInput: {
					filePath: testFile,
					operations: [
						{ search: 'quick', replace: 'slow' },
						{ search: 'brown', replace: 'red' },
						{ search: 'lazy', replace: 'energetic' },
					],
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: multiple_replace_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully\n✅   Operation 2: Operation 2 completed successfully\n✅   Operation 3: Operation 3 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 4, 'toolResults should have 4 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'Search and replace operations applied to file: multiple_replace_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			for (let i = 1; i <= 3; i++) {
				const operationResult = result.toolResults[i];
				assert(operationResult.type === 'text', `Result ${i} should be of type text`);
				assertStringIncludes(operationResult.text, `Operation ${i} completed successfully`);
			}

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'The slow red fox jumps over the energetic dog');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Multiple replacements',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
			const testFile = 'multiple_replace_test.txt';
			const testFilePath = getTestFilePath(testFile);
			await Deno.writeTextFile(testFilePath, 'abcdefg');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_and_replace',
				toolInput: {
					filePath: testFile,
					operations: [
						{ search: 'abc', replace: 'ABC' },
						{ search: 'efg', replace: 'EFG' },
					],
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: multiple_replace_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully\n✅   Operation 2: Operation 2 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'Search and replace operations applied to file: multiple_replace_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			for (let i = 1; i <= 2; i++) {
				const operationResult = result.toolResults[i];
				assert(operationResult.type === 'text', `Result ${i} should be of type text`);
				assertStringIncludes(operationResult.text, `Operation ${i} completed successfully`);
			}

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'ABCdEFG');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - Overlapping replacements',
	fn: async () => {
		const tool = new LLMToolSearchAndReplace();
		const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
		try {
			const testFile = 'overlapping_replace_test.txt';
			const testFilePath = getTestFilePath(testFile);
			await Deno.writeTextFile(testFilePath, 'abcdefg');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_and_replace',
				toolInput: {
					filePath: testFile,
					operations: [
						{ search: 'abc', replace: 'ABC' },
						{ search: 'Cde', replace: 'CDE' },
					],
				},
			};

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai applied search and replace operations.\nSearch and replace operations applied to file: overlapping_replace_test.txt. All operations succeeded.\n✅   Operation 1: Operation 1 completed successfully\n✅   Operation 2: Operation 2 completed successfully',
			);
			assertStringIncludes(result.toolResponse, 'All operations succeeded');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(
				firstResult.text,
				'Search and replace operations applied to file: overlapping_replace_test.txt',
			);
			assertStringIncludes(firstResult.text, 'All operations succeeded');

			for (let i = 1; i <= 2; i++) {
				const operationResult = result.toolResults[i];
				assert(operationResult.type === 'text', `Result ${i} should be of type text`);
				assertStringIncludes(operationResult.text, `Operation ${i} completed successfully`);
			}

			const updatedContent = await Deno.readTextFile(testFilePath);
			assertEquals(updatedContent, 'ABCDEfg');
		} finally {
			logPatchAndCommitStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

//cleanupTestDirectory();
