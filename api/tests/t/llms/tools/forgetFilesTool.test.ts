import { assert, assertEquals, assertStringIncludes } from '../../../deps.ts';
import { join } from '@std/path';

import LLMToolForgetFiles from '../../../../src/llms/tools/forgetFilesTool.ts';
import ProjectEditor from '../../../../src/editor/projectEditor.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';

const projectEditor = await getProjectEditor(Deno.makeTempDirSync());
const testProjectRoot = projectEditor.projectRoot;
console.log('Project editor root:', testProjectRoot);

async function getProjectEditor(testProjectRoot: string): Promise<ProjectEditor> {
	await GitUtils.initGit(testProjectRoot);
	return await new ProjectEditor(testProjectRoot).init();
}

/*
function cleanupTestDirectory() {
	for (const entry of Deno.readDirSync(testProjectRoot)) {
		Deno.removeSync(join(testProjectRoot, entry.name), { recursive: true });
	}
}
 */

Deno.test({
	name: 'ForgetFilesTool - Forget existing files from conversation',
	fn: async () => {
		const tool = new LLMToolForgetFiles();

		const messageId = '1111-2222';
		// Create test files and add them to the conversation
		await Deno.writeTextFile(join(testProjectRoot, 'file1.txt'), 'Content of file1');
		await Deno.writeTextFile(join(testProjectRoot, 'file2.txt'), 'Content of file2');
		const initialConversation = await projectEditor.initConversation('test-conversation-id');
		initialConversation.addFileForMessage('file1.txt', {
			size: 'Content of file1'.length,
			lastModified: new Date(),
		}, messageId);
		initialConversation.addFileForMessage('file2.txt', {
			size: 'Content of file2'.length,
			lastModified: new Date(),
		}, messageId);

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'forget_files',
			toolInput: {
				fileNames: ['file1.txt', 'file2.txt'],
			},
		};

		const result = await tool.runTool(initialConversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai has removed these files from the conversation');
		assertStringIncludes(result.toolResponse, 'Removed files from the conversation:\n- file1.txt\n- file2.txt');

		// Check toolResults
		assert(Array.isArray(result.toolResults), 'toolResults should be an array');
		assert(result.toolResults.length > 0, 'toolResults should not be empty');
		assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

		const firstResult = result.toolResults[0];
		assert(firstResult.type === 'text', 'First result should be of type text');
		assertStringIncludes(firstResult.text, 'File removed: file1.txt');

		const secondResult = result.toolResults[1];
		assert(secondResult.type === 'text', 'Second result should be of type text');
		assertStringIncludes(secondResult.text, 'File removed: file2.txt');

		// Check if files are removed from the conversation
		const conversation = await projectEditor.initConversation('test-conversation-id');
		const file1 = conversation.getFile('file1.txt');
		const file2 = conversation.getFile('file2.txt');
		assertEquals(file1, undefined, 'file1.txt should not exist in the conversation');
		assertEquals(file2, undefined, 'file2.txt should not exist in the conversation');

		// Check if listFiles doesn't return the removed files
		const fileList = conversation.listFiles();
		assertEquals(fileList?.includes('file1.txt'), false, 'file1.txt should not be in the file list');
		assertEquals(fileList?.includes('file2.txt'), false, 'file2.txt should not be in the file list');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ForgetFilesTool - Attempt to forget non-existent file',
	fn: async () => {
		const tool = new LLMToolForgetFiles();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'forget_files',
			toolInput: {
				fileNames: ['non_existent.txt'],
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai failed to remove these files from the conversation');
		assertStringIncludes(result.toolResponse, 'non_existent.txt: File is not in the conversation history');

		// Check toolResults
		assert(Array.isArray(result.toolResults), 'toolResults should be an array');
		assert(result.toolResults.length > 0, 'toolResults should not be empty');
		assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

		const firstResult = result.toolResults[0];
		assert(firstResult.type === 'text', 'First result should be of type text');
		assertStringIncludes(firstResult.text, 'non_existent.txt: File is not in the conversation history');

		// Check that listFiles doesn't include the non-existent file
		const fileList = conversation.listFiles();
		assertEquals(fileList?.includes('non_existent.txt'), false, 'non_existent.txt should not be in the file list');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ForgetFilesTool - Forget mix of existing and non-existent files',
	fn: async () => {
		const tool = new LLMToolForgetFiles();

		const messageId = '1111-2222';
		// Create test file and add it to the conversation
		await Deno.writeTextFile(join(testProjectRoot, 'existing_file.txt'), 'Content of existing file');
		const conversation = await projectEditor.initConversation('test-conversation-id');
		conversation.addFileForMessage('existing_file.txt', {
			size: 'Content of existing file'.length,
			lastModified: new Date(),
		}, messageId);

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'forget_files',
			toolInput: {
				fileNames: ['existing_file.txt', 'non_existent_file.txt'],
			},
		};

		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai has removed these files from the conversation: existing_file.txt',
		);
		assertStringIncludes(
			result.bbaiResponse,
			'BBai failed to remove these files from the conversation:\n- non_existent_file.txt: File is not in the conversation history',
		);

		assertStringIncludes(result.toolResponse, 'Removed files from the conversation:\n- existing_file.txt');
		assertStringIncludes(
			result.toolResponse,
			'Failed to remove files from the conversation:\n- non_existent_file.txt: File is not in the conversation history',
		);

		// Check toolResults
		assert(Array.isArray(result.toolResults), 'toolResults should be an array');
		assert(result.toolResults.length > 0, 'toolResults should not be empty');
		assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

		const firstResult = result.toolResults[0];
		assert(firstResult.type === 'text', 'First result should be of type text');
		assertStringIncludes(firstResult.text, 'File removed: existing_file.txt');

		const secondResult = result.toolResults[1];
		assert(secondResult.type === 'text', 'Second result should be of type text');
		assertStringIncludes(
			secondResult.text,
			'Error removing file non_existent_file.txt: File is not in the conversation history',
		);

		// Check if existing file is forgotten from the conversation
		const existingFile = conversation.getFile('existing_file.txt');
		assertEquals(existingFile, undefined, 'existing_file.txt should not exist in the conversation');

		// Check that listFiles doesn't include either file
		const fileList = conversation.listFiles();
		assertEquals(
			fileList?.includes('existing_file.txt'),
			false,
			'existing_file.txt should not be in the file list',
		);
		assertEquals(
			fileList?.includes('non_existent_file.txt'),
			false,
			'non_existent_file.txt should not be in the file list',
		);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
