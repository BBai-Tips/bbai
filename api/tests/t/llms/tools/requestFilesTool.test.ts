import { assert, assertEquals, assertExists, assertRejects, assertStringIncludes } from '../../../deps.ts';
import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import { LLMToolRequestFiles } from '../../../../src/llms/tools/requestFilesTool.ts';
import ProjectEditor from '../../../../src/editor/projectEditor.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';

const projectEditor = await getProjectEditor(Deno.makeTempDirSync());
const testProjectRoot = projectEditor.projectRoot;
console.log('Project editor root:', testProjectRoot);

async function getProjectEditor(testProjectRoot: string): Promise<ProjectEditor> {
	//await ensureDir(testProjectRoot);
	await GitUtils.initGit(testProjectRoot);
	return await new ProjectEditor(testProjectRoot).init();
}

function cleanupTestDirectory() {
	for (const entry of Deno.readDirSync(testProjectRoot)) {
		Deno.removeSync(join(testProjectRoot, entry.name), { recursive: true });
	}
}

Deno.test({
	name: 'RequestFilesTool - Request existing files',
	fn: async () => {
		const tool = new LLMToolRequestFiles();

		// Create test files
		await Deno.writeTextFile(join(testProjectRoot, 'file1.txt'), 'Content of file1');
		await Deno.writeTextFile(join(testProjectRoot, 'file2.txt'), 'Content of file2');

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'request_files',
			toolInput: {
				fileNames: ['file1.txt', 'file2.txt'],
			},
		};

		const initialConversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(initialConversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai has added these files to the conversation');
		assertStringIncludes(result.toolResponse, 'Added files to the conversation:\n- file1.txt\n- file2.txt');

		// Check toolResults
		assert(Array.isArray(result.toolResults), 'toolResults should be an array');
		assert(result.toolResults.length > 0, 'toolResults should not be empty');
		assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

		const firstResult = result.toolResults[0];
		assert(firstResult.type === 'text', 'First result should be of type text');
		assertStringIncludes(firstResult.text, 'File added: file1.txt');
		assertStringIncludes(firstResult.text, 'file1.txt');

		const secondResult = result.toolResults[1];
		assert(secondResult.type === 'text', 'Second result should be of type text');
		assertStringIncludes(secondResult.text, 'File added: file2.txt');

		//
		// 		// Check if files are added to the conversation
		// 		const updatedConversation = await projectEditor.initConversation('test-conversation-id');
		// 		const updatedResult = await tool.runTool(initialConversation, toolUse, projectEditor);
		// 		const file1 = await updatedConversation.getFile('file1.txt');
		// 		const file2 = await updatedConversation.getFile('file2.txt');
		// 		assertExists(file1, 'file1.txt should exist in the conversation');
		// 		assertExists(file2, 'file2.txt should exist in the conversation');
		//
		// 		// Check if listFiles returns the correct files
		// 		const fileList = await updatedConversation.listFiles();
		// 		assertEquals(fileList?.includes('file1.txt'), true, 'file1.txt should be in the file list');
		// 		assertEquals(fileList?.includes('file2.txt'), true, 'file2.txt should be in the file list');
		//
		// 		// Check if getFiles returns the correct Map of FileMetadata objects
		// 		const files = await updatedConversation.getFiles();
		// 		assertEquals(files?.size, 2, 'getFiles should return a Map with 2 FileMetadata objects');
		// 		assertExists(files?.get('file1.txt'), 'FileMetadata for file1.txt should exist');
		// 		assertExists(files?.get('file2.txt'), 'FileMetadata for file2.txt should exist');
		//
		// 		// Verify that FileMetadata objects contain the correct information
		// 		const file1Metadata = files?.get('file1.txt');
		// 		const file2Metadata = files?.get('file2.txt');
		// 		assertEquals(file1Metadata?.path, 'file1.txt', 'file1.txt should have correct path');
		// 		assertEquals(file2Metadata?.path, 'file2.txt', 'file2.txt should have correct path');
		// 		assertEquals(file1Metadata?.size, 'Content of file1'.length, 'file1.txt should have correct size');
		// 		assertEquals(file2Metadata?.size, 'Content of file2'.length, 'file2.txt should have correct size');
		// 		assertExists(file1Metadata?.lastModified, 'file1.txt should have a lastModified date');
		// 		assertExists(file2Metadata?.lastModified, 'file2.txt should have a lastModified date');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RequestFilesTool - Request non-existent file',
	fn: async () => {
		const tool = new LLMToolRequestFiles();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'request_files',
			toolInput: {
				fileNames: ['non_existent.txt'],
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai failed to add these files to the conversation');
		assertStringIncludes(result.toolResponse, 'No files added');

		// Check toolResults
		assert(Array.isArray(result.toolResults), 'toolResults should be an array');
		assert(result.toolResults.length > 0, 'toolResults should not be empty');
		assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

		const firstResult = result.toolResults[0];
		assert(firstResult.type === 'text', 'First result should be of type text');
		assertStringIncludes(firstResult.text, 'Error adding file non_existent.txt: No such file or directory');
		assertStringIncludes(firstResult.text, 'non_existent.txt');

		// Check that the non-existent file is not in the conversation
		const nonExistentFile = conversation.getFile('non_existent.txt');
		assertEquals(nonExistentFile, undefined, 'non_existent.txt should not be in the conversation');

		// Check that listFiles doesn't include the non-existent file
		const fileList = conversation.listFiles();
		assertEquals(fileList?.includes('non_existent.txt'), false, 'non_existent.txt should not be in the file list');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RequestFilesTool - Request file outside project root',
	fn: async () => {
		const tool = new LLMToolRequestFiles();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'request_files',
			toolInput: {
				fileNames: ['../outside_project.txt'],
			},
		};
		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai failed to add these files to the conversation');
		assertStringIncludes(result.toolResponse, '../outside_project.txt: Access denied');

		// Check toolResults
		assert(Array.isArray(result.toolResults), 'toolResults should be an array');
		assert(result.toolResults.length > 0, 'toolResults should not be empty');
		assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

		const firstResult = result.toolResults[0];
		assert(firstResult.type === 'text', 'First result should be of type text');
		assertStringIncludes(firstResult.text, '../outside_project.txt: Access denied');

		// Check that the outside file is not in the conversation
		const outsideFile = conversation.getFile('../outside_project.txt');
		assertEquals(outsideFile, undefined, '../outside_project.txt should not be in the conversation');

		// Check that listFiles doesn't include the outside file
		const fileList = conversation.listFiles();
		assertEquals(
			fileList?.includes('../outside_project.txt'),
			false,
			'../outside_project.txt should not be in the file list',
		);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
