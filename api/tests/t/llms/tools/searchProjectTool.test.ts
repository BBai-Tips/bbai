import { assert, assertStringIncludes } from '../../../deps.ts';
import { join } from '@std/path';

import { LLMToolSearchProject } from '../../../../src/llms/tools/searchProjectTool.ts';
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

async function createTestFiles() {
	Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
	Deno.writeTextFileSync(join(testProjectRoot, 'file2.js'), 'console.log("Hello, JavaScript!");');
	Deno.mkdirSync(join(testProjectRoot, 'subdir'));
	Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file3.txt'), 'Hello from subdirectory!');
	Deno.writeTextFileSync(join(testProjectRoot, 'large_file.txt'), 'A'.repeat(10000)); // 10KB file
	// Create an empty file for edge case testing
	Deno.writeTextFileSync(join(testProjectRoot, 'empty_file.txt'), '');

	// Set specific modification times for date-based search tests
	const pastDate = new Date('2023-01-01T00:00:00Z');
	const futureDate = new Date('2025-01-01T00:00:00Z');
	const currentDate = new Date();
	await setFileModificationTime(join(testProjectRoot, 'file1.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'file2.js'), futureDate);
	await setFileModificationTime(join(testProjectRoot, 'subdir', 'file3.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'large_file.txt'), currentDate);
	await setFileModificationTime(join(testProjectRoot, 'empty_file.txt'), currentDate);
}

await createTestFiles();

// Helper function to set file modification time
async function setFileModificationTime(filePath: string, date: Date) {
	await Deno.utime(filePath, date, date);
}

Deno.test({
	name: 'SearchProjectTool - Basic content search functionality',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				content_pattern: 'Hello',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 3 files matching the search criteria: content pattern "Hello"',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 3 files matching the search criteria: content pattern "Hello"',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(toolResults, '3 files match the search criteria: content pattern "Hello"');
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['file1.txt', 'file2.js', 'subdir/file3.txt'];
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Date-based search',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				date_after: '2024-01-01',
				date_before: '2026-01-01',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);
		//console.log('Date-based search response:', result.bbaiResponse);
		//console.log('Date-based search files:', result.toolResults);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 3 files matching the search criteria: modified after 2024-01-01, modified before 2026-01-01',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 3 files matching the search criteria: modified after 2024-01-01, modified before 2026-01-01',
		);

		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'3 files match the search criteria: modified after 2024-01-01, modified before 2026-01-01',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['file2.js', 'large_file.txt', 'empty_file.txt'];
		//console.log('Expected files:', expectedFiles);
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - File-only search (metadata)',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				file_pattern: '*.txt',
				size_min: 1,
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);
		//console.log('File-only search response:', result.bbaiResponse);
		//console.log('File-only search files:', result.toolResults);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 2 files matching the search criteria: file pattern "*.txt", minimum size 1 bytes',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 2 files matching the search criteria: file pattern "*.txt", minimum size 1 bytes',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'2 files match the search criteria: file pattern "*.txt", minimum size 1 bytes',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['file1.txt', 'large_file.txt'];
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Combining all search criteria',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				content_pattern: 'Hello',
				file_pattern: '*.txt',
				size_min: 1,
				size_max: 1000,
				date_after: '2022-01-01',
				date_before: '2024-01-01',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);
		console.log('Date-based search response:', result.bbaiResponse);
		console.log('Date-based search files:', result.toolResults);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 2 files matching the search criteria: content pattern "Hello", file pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
		);

		assertStringIncludes(
			result.toolResponse,
			'Found 2 files matching the search criteria: content pattern "Hello", file pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'2 files match the search criteria: content pattern "Hello", file pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['file1.txt', 'subdir/file3.txt'];
		console.log('Expected files:', expectedFiles);
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Edge case: empty file',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				file_pattern: '*.txt',
				size_max: 0,
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 1 files matching the search criteria: file pattern "*.txt", maximum size 0 bytes',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 1 files matching the search criteria: file pattern "*.txt", maximum size 0 bytes',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'1 files match the search criteria: file pattern "*.txt", maximum size 0 bytes',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['empty_file.txt'];
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with file pattern',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				content_pattern: 'Hello',
				file_pattern: '*.txt',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 2 files matching the search criteria: content pattern "Hello", file pattern "*.txt"',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 2 files matching the search criteria: content pattern "Hello", file pattern "*.txt"',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'2 files match the search criteria: content pattern "Hello", file pattern "*.txt"',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['file1.txt', 'subdir/file3.txt'];
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with file size criteria',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				file_pattern: '*.txt',
				size_min: 5000,
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 1 files matching the search criteria: file pattern "*.txt", minimum size 5000 bytes',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 1 files matching the search criteria: file pattern "*.txt", minimum size 5000 bytes',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'1 files match the search criteria: file pattern "*.txt", minimum size 5000 bytes',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['large_file.txt'];
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with no results',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				content_pattern: 'NonexistentPattern',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 0 files matching the search criteria: content pattern "NonexistentPattern"',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 0 files matching the search criteria: content pattern "NonexistentPattern"',
		);
		assertStringIncludes(
			result.toolResults as string,
			'0 files match the search criteria: content pattern "NonexistentPattern"',
		);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Error handling for invalid search pattern',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				content_pattern: '[', // Invalid regex pattern
			},
		};
		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 0 files matching the search criteria: content pattern "["',
		);
		assertStringIncludes(result.toolResponse, 'Found 0 files matching the search criteria: content pattern "["');
		assertStringIncludes(result.toolResults as string, '0 files match the search criteria: content pattern "["');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with multiple criteria',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				content_pattern: 'Hello',
				file_pattern: '*.txt',
				size_max: 1000,
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 2 files matching the search criteria: content pattern "Hello", file pattern "*.txt", maximum size 1000 bytes',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 2 files matching the search criteria: content pattern "Hello", file pattern "*.txt", maximum size 1000 bytes',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'2 files match the search criteria: content pattern "Hello", file pattern "*.txt", maximum size 1000 bytes',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['file1.txt', 'subdir/file3.txt'];
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with bare filename',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				file_pattern: 'file2.js',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 1 files matching the search criteria: file pattern "file2.js"',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 1 files matching the search criteria: file pattern "file2.js"',
		);
		const toolResults = result.toolResults as string;
		assertStringIncludes(
			toolResults,
			'1 files match the search criteria: file pattern "file2.js"',
		);
		assertStringIncludes(toolResults, '<files>');
		assertStringIncludes(toolResults, '</files>');

		const expectedFiles = ['file2.js'];
		const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
		const foundFiles = fileContent.split('\n');

		expectedFiles.forEach((file) => {
			assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
		});
		assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
