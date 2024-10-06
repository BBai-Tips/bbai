import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';
import { join } from '@std/path';
import { ensureFile, exists } from '@std/fs';

import LLMToolRenameFiles from '../tool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, withTestProject } from 'api/tests/testSetup.ts';

Deno.test({
	name: 'RenameFilesTool - Rename single file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const sourceFile = join(testProjectRoot, 'source.txt');
			const destFile = join(testProjectRoot, 'renamed.txt');
			await ensureFile(sourceFile);
			await Deno.writeTextFile(sourceFile, 'test content');

			const tool = new LLMToolRenameFiles();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'rename_files',
				toolInput: {
					operations: [{ source: 'source.txt', destination: 'renamed.txt' }],
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Rename single file - bbaiResponse:', result.bbaiResponse);
			// console.log('Rename single file - toolResponse:', result.toolResponse);
			// console.log('Rename single file - toolResults:', result.toolResults);

			assertStringIncludes(result.bbaiResponse, 'BBai has renamed these files');
			assertStringIncludes(result.toolResponse, 'Renamed files');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 1, 'toolResults should have 1 element');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'File/Directory renamed: ');
			assertStringIncludes(firstResult.text, 'source.txt');
			assertStringIncludes(firstResult.text, 'renamed.txt');

			// Check that the file was renamed
			assert(!(await exists(sourceFile)), 'Source file should not exist');
			assert(await exists(destFile), 'Destination file should exist');
			assertEquals(await Deno.readTextFile(destFile), 'test content', 'File content should be preserved');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Create missing directories',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const sourceFile = join(testProjectRoot, 'source.txt');
			const destFile = join(testProjectRoot, 'new_dir', 'renamed.txt');
			await ensureFile(sourceFile);
			await Deno.writeTextFile(sourceFile, 'test content');

			const tool = new LLMToolRenameFiles();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'rename_files',
				toolInput: {
					operations: [{ source: 'source.txt', destination: join('new_dir', 'renamed.txt') }],
					createMissingDirectories: true,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(result.bbaiResponse, 'BBai has renamed these files');
			assertStringIncludes(result.toolResponse, 'Renamed files');

			assert(!(await exists(sourceFile)), 'Source file should not exist');
			assert(await exists(destFile), 'Destination file should exist');
			assertEquals(await Deno.readTextFile(destFile), 'test content', 'File content should be preserved');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Fail to create missing directories',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const sourceFile = join(testProjectRoot, 'source.txt');
			const destFile = join(testProjectRoot, 'new_dir', 'renamed.txt');
			await ensureFile(sourceFile);
			await Deno.writeTextFile(sourceFile, 'test content');

			const tool = new LLMToolRenameFiles();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'rename_files',
				toolInput: {
					operations: [{ source: 'source.txt', destination: join('new_dir', 'renamed.txt') }],
					createMissingDirectories: false,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(result.bbaiResponse, 'BBai failed to rename these files');
			assertStringIncludes(result.toolResponse, 'Failed to rename files');

			assert(await exists(sourceFile), 'Source file should still exist');
			assert(!(await exists(destFile)), 'Destination file should not exist');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Rename multiple files',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const sourceFile1 = join(testProjectRoot, 'file1.txt');
			const sourceFile2 = join(testProjectRoot, 'file2.txt');
			const destFile1 = join(testProjectRoot, 'renamed1.txt');
			const destFile2 = join(testProjectRoot, 'renamed2.txt');
			await ensureFile(sourceFile1);
			await ensureFile(sourceFile2);
			await Deno.writeTextFile(sourceFile1, 'content1');
			await Deno.writeTextFile(sourceFile2, 'content2');

			const tool = new LLMToolRenameFiles();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'rename_files',
				toolInput: {
					operations: [
						{ source: 'file1.txt', destination: 'renamed1.txt' },
						{ source: 'file2.txt', destination: 'renamed2.txt' },
					],
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(result.bbaiResponse, 'BBai has renamed these files');
			assertStringIncludes(result.toolResponse, 'Renamed files');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			assert(!(await exists(sourceFile1)), 'Source file 1 should not exist');
			assert(!(await exists(sourceFile2)), 'Source file 2 should not exist');
			assert(await exists(destFile1), 'Destination file 1 should exist');
			assert(await exists(destFile2), 'Destination file 2 should exist');
			assertEquals(await Deno.readTextFile(destFile1), 'content1', 'File 1 content should be preserved');
			assertEquals(await Deno.readTextFile(destFile2), 'content2', 'File 2 content should be preserved');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Overwrite existing file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const sourceFile = join(testProjectRoot, 'source.txt');
			const destFile = join(testProjectRoot, 'existing.txt');
			await ensureFile(sourceFile);
			await ensureFile(destFile);
			await Deno.writeTextFile(sourceFile, 'new content');
			await Deno.writeTextFile(destFile, 'old content');

			const tool = new LLMToolRenameFiles();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'rename_files',
				toolInput: {
					operations: [{ source: 'source.txt', destination: 'existing.txt' }],
					overwrite: true,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(result.bbaiResponse, 'BBai has renamed these files');
			assertStringIncludes(result.toolResponse, 'Renamed files');

			assert(!(await exists(sourceFile)), 'Source file should not exist');
			assert(await exists(destFile), 'Destination file should exist');
			assertEquals(await Deno.readTextFile(destFile), 'new content', 'Destination file should be overwritten');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Fail to overwrite without permission',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const sourceFile = join(testProjectRoot, 'source.txt');
			const destFile = join(testProjectRoot, 'existing.txt');
			await ensureFile(sourceFile);
			await ensureFile(destFile);
			await Deno.writeTextFile(sourceFile, 'new content');
			await Deno.writeTextFile(destFile, 'old content');

			const tool = new LLMToolRenameFiles();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'rename_files',
				toolInput: {
					operations: [{ source: 'source.txt', destination: 'existing.txt' }],
					overwrite: false,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(result.bbaiResponse, 'BBai failed to rename these files');
			assertStringIncludes(result.toolResponse, 'Failed to rename files');

			assert(await exists(sourceFile), 'Source file should still exist');
			assert(await exists(destFile), 'Destination file should still exist');
			assertEquals(await Deno.readTextFile(sourceFile), 'new content', 'Source file content should be unchanged');
			assertEquals(
				await Deno.readTextFile(destFile),
				'old content',
				'Destination file should not be overwritten',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Attempt to rename non-existent file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);

			const nonExistentFile = join(testProjectRoot, 'non_existent.txt');
			const destFile = join(testProjectRoot, 'renamed.txt');

			const tool = new LLMToolRenameFiles();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'rename_files',
				toolInput: {
					operations: [{ source: 'non_existent.txt', destination: 'renamed.txt' }],
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(result.bbaiResponse, 'BBai failed to rename these files');
			assertStringIncludes(result.toolResponse, 'Failed to rename files');

			assert(!(await exists(nonExistentFile)), 'Source file should not exist');
			assert(!(await exists(destFile)), 'Destination file should not exist');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
