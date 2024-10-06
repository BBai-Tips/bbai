import { join } from '@std/path';
//import { existsSync } from '@std/fs';

import { assert, assertStringIncludes } from 'api/tests/deps.ts';
import LLMToolSearchProject from '../tool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, withTestProject } from 'api/tests/testSetup.ts';

async function createTestFiles(testProjectRoot: string) {
	Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
	Deno.writeTextFileSync(join(testProjectRoot, 'file2.js'), 'console.log("Hello, JavaScript!");');
	Deno.mkdirSync(join(testProjectRoot, 'subdir'));
	Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file3.txt'), 'Hello from subdirectory!');
	Deno.writeTextFileSync(join(testProjectRoot, 'large_file.txt'), 'A'.repeat(10000)); // 10KB file
	// Create an empty file for edge case testing
	Deno.writeTextFileSync(join(testProjectRoot, 'empty_file.txt'), '');

	// Create a large file with a pattern that spans potential buffer boundaries
	const largeFileContent = 'A'.repeat(1024 * 1024) + // 1MB of 'A's
		'Start of pattern\n' +
		'B'.repeat(1024) + // 1KB of 'B's
		'\nEnd of pattern' +
		'C'.repeat(1024 * 1024); // Another 1MB of 'C's

	Deno.writeTextFileSync(join(testProjectRoot, 'large_file_with_pattern.txt'), largeFileContent);

	// Create files with special content for regex testing
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test1.txt'), 'This is a test. Another test.');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test2.txt'), 'Testing 123, testing 456.');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test3.txt'), 'Test@email.com and another.test@email.com');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test4.txt'), 'https://example.com and http://test.com');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test5.txt'), 'Telephone: 123-456-7890 and (987) 654-3210');

	// Set specific modification times for date-based search tests
	const pastDate = new Date('2023-01-01T00:00:00Z');
	const futureDate = new Date('2025-01-01T00:00:00Z');
	const currentDate = new Date();
	await setFileModificationTime(join(testProjectRoot, 'file1.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'file2.js'), futureDate);
	await setFileModificationTime(join(testProjectRoot, 'subdir', 'file3.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'large_file.txt'), currentDate);
	await setFileModificationTime(join(testProjectRoot, 'empty_file.txt'), currentDate);
	// Set modification time for the very large file
	await setFileModificationTime(join(testProjectRoot, 'large_file_with_pattern.txt'), currentDate);
}

// Helper function to set file modification time
async function setFileModificationTime(filePath: string, date: Date) {
	await Deno.utime(filePath, date, date);
}

Deno.test({
	name: 'SearchProjectTool - Basic content search functionality',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
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

			// Add a delay before cleanup
			await new Promise((resolve) => setTimeout(resolve, 1000));
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search pattern spanning multiple buffers',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Start of pattern\\n[B]+\\nEnd of pattern',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search pattern spanning multiple buffers - bbaiResponse:', result.bbaiResponse);
			// console.log('Search pattern spanning multiple buffers - toolResponse:', result.toolResponse);
			// console.log('Search pattern spanning multiple buffers - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 1 files matching the search criteria',
			);
			assertStringIncludes(
				result.toolResponse,
				'Found 1 files matching the search criteria',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '1 files match the search criteria');

			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = ['large_file_with_pattern.txt'];
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Date-based search',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					dateAfter: '2024-01-01',
					dateBefore: '2026-01-01',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			//console.log('Date-based search response:', result.bbaiResponse);
			//console.log('Date-based search files:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 9 files matching the search criteria: modified after 2024-01-01, modified before 2026-01-01',
			);
			assertStringIncludes(
				result.toolResponse,
				'Found 9 files matching the search criteria: modified after 2024-01-01, modified before 2026-01-01',
			);

			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'9 files match the search criteria: modified after 2024-01-01, modified before 2026-01-01',
			);
			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = [
				'file2.js',
				'large_file.txt',
				'empty_file.txt',
				'large_file_with_pattern.txt',
				'regex_test1.txt',
				'regex_test2.txt',
				'regex_test3.txt',
				'regex_test4.txt',
				'regex_test5.txt',
			];
			//console.log('Expected files:', expectedFiles);
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - File-only search (metadata)',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					filePattern: '*.txt',
					sizeMin: 1,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('File-only search (metadata) - bbaiResponse:', result.bbaiResponse);
			// console.log('File-only search (metadata) - toolResponse:', result.toolResponse);
			// console.log('File-only search (metadata) - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 9 files matching the search criteria: file pattern "*.txt", minimum size 1 bytes',
			);
			assertStringIncludes(
				result.toolResponse,
				'Found 9 files matching the search criteria: file pattern "*.txt", minimum size 1 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'9 files match the search criteria: file pattern "*.txt", minimum size 1 bytes',
			);
			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = [
				'file1.txt',
				'large_file.txt',
				'large_file_with_pattern.txt',
				'regex_test1.txt',
				'regex_test2.txt',
				'regex_test3.txt',
				'regex_test4.txt',
				'regex_test5.txt',
				'subdir/file3.txt',
			];
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Combining all search criteria',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
					filePattern: '*.txt',
					sizeMin: 1,
					sizeMax: 1000,
					dateAfter: '2022-01-01',
					dateBefore: '2024-01-01',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Combining all search criteria - bbaiResponse:', result.bbaiResponse);
			// console.log('Combining all search criteria - toolResponse:', result.toolResponse);
			// console.log('Combining all search criteria - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 2 files matching the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
			);

			assertStringIncludes(
				result.toolResponse,
				'Found 2 files matching the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 files match the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
Deno.test({
	name: 'SearchProjectTool - Edge case: empty file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					filePattern: '*.txt',
					sizeMax: 0,
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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with file pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
					filePattern: '*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 2 files matching the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt"',
			);
			assertStringIncludes(
				result.toolResponse,
				'Found 2 files matching the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt"',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 files match the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt"',
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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with file size criteria',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					filePattern: '*.txt',
					sizeMin: 5000,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 2 files matching the search criteria: file pattern "*.txt", minimum size 5000 bytes',
			);
			assertStringIncludes(
				result.toolResponse,
				'Found 2 files matching the search criteria: file pattern "*.txt", minimum size 5000 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 files match the search criteria: file pattern "*.txt", minimum size 5000 bytes',
			);
			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = ['large_file.txt', 'large_file_with_pattern.txt'];
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with no results',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'NonexistentPattern',
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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Error handling for invalid search pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: '[', // Invalid regex pattern
				},
			};
			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Error handling for invalid search pattern - bbaiResponse:', result.bbaiResponse);
			// console.log('Error handling for invalid search pattern - toolResponse:', result.toolResponse);
			// console.log('Error handling for invalid search pattern - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 0 files matching the search criteria: content pattern "["',
			);
			assertStringIncludes(
				result.toolResponse,
				'Found 0 files matching the search criteria: content pattern "["',
			);
			assertStringIncludes(
				result.toolResults as string,
				'Invalid regular expression: /[/i: Unterminated character class',
			);
			assertStringIncludes(
				result.toolResults as string,
				'0 files match the search criteria: content pattern "["',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with multiple criteria',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
					filePattern: '*.txt',
					sizeMax: 1000,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 2 files matching the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt", maximum size 1000 bytes',
			);
			assertStringIncludes(
				result.toolResponse,
				'Found 2 files matching the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt", maximum size 1000 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 files match the search criteria: content pattern "Hello", case-insensitive, file pattern "*.txt", maximum size 1000 bytes',
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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with bare filename',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					filePattern: 'file2.js',
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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with specific content and file pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			// Create a test file with the specific content
			const testFilePath = join(testProjectRoot, 'bui', 'src', 'islands', 'Chat.tsx');
			await Deno.mkdir(join(testProjectRoot, 'bui', 'src', 'islands'), { recursive: true });
			await Deno.writeTextFile(testFilePath, 'const title = currentConversation?.title;');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: String.raw`currentConversation\?\.title`,
					filePattern: 'bui/src/islands/Chat.tsx',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			// console.info('Tool result:', result);
			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "currentConversation\?\.title", case-insensitive, file pattern "bui/src/islands/Chat.tsx"`,
			);
			assertStringIncludes(
				result.toolResponse,
				String
					.raw`Found 1 files matching the search criteria: content pattern "currentConversation\?\.title", case-insensitive, file pattern "bui/src/islands/Chat.tsx"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				String
					.raw`1 files match the search criteria: content pattern "currentConversation\?\.title", case-insensitive, file pattern "bui/src/islands/Chat.tsx"`,
			);
			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = ['bui/src/islands/Chat.tsx'];
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');

			// Clean up the test file
			await Deno.remove(testFilePath);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with word boundary regex',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: String.raw`\btest\b`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 3 files matching the search criteria: content pattern "\btest\b", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test1.txt');
			assert(!toolResults.includes('regex_test2.txt'), 'regex_test2.txt should not be in the results');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with email regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test3.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with URL regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test4.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with phone number regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`(\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s*\d{3}[-.]?\d{4})`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "(\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s*\d{3}[-.]?\d{4})", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test5.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with complex regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test3.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with regex using quantifiers - case-sensitive',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`test.*test`,
					filePattern: 'regex_test*.txt',
					caseSensitive: true,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search with regex using quantifiers - case-sensitive - bbaiResponse:', result.bbaiResponse);
			// console.log('Search with regex using quantifiers - case-sensitive - toolResponse:', result.toolResponse);
			// console.log('Search with regex using quantifiers - case-sensitive - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "test.*test", case-sensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test1.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with regex using quantifiers - case-insensitive',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`test.*test`,
					filePattern: 'regex_test*.txt',
					caseSensitive: false,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search with regex using quantifiers - case-insensitive - bbaiResponse:', result.bbaiResponse);
			// console.log('Search with regex using quantifiers - case-insensitive - toolResponse:', result.toolResponse);
			// console.log('Search with regex using quantifiers - case-insensitive - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 3 files matching the search criteria: content pattern "test.*test", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test1.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with regex using character classes',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`[Tt]esting [0-9]+`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "[Tt]esting [0-9]+", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test2.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with lookahead regex',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`Test(?=ing)`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 1 files matching the search criteria: content pattern "Test(?=ing)", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test2.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with negative lookahead regex',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`test(?!ing)`,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search with negative lookahead regex - bbaiResponse:', result.bbaiResponse);
			// console.log('Search with negative lookahead regex - toolResponse:', result.toolResponse);
			// console.log('Search with negative lookahead regex - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				String
					.raw`BBai found 3 files matching the search criteria: content pattern "test(?!ing)", case-insensitive, file pattern "regex_test*.txt"`,
			);
			const toolResults = result.toolResults as string;

			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = ['regex_test1.txt', 'regex_test3.txt', 'regex_test4.txt'];
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Case-sensitive search',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: 'Test',
					caseSensitive: true,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Case-sensitive search - bbaiResponse:', result.bbaiResponse);
			// console.log('Case-sensitive search - toolResponse:', result.toolResponse);
			// console.log('Case-sensitive search - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 2 files matching the search criteria: content pattern "Test", case-sensitive, file pattern "regex_test*.txt"',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = ['regex_test2.txt', 'regex_test3.txt'];
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');

			assert(!toolResults.includes('regex_test1.txt'), `This file contains 'test' but not 'Test'`);
			assert(!toolResults.includes('regex_test4.txt'), `This file contains 'test' but not 'Test'`);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Case-insensitive search',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			await createTestFiles(testProjectRoot);

			const tool = new LLMToolSearchProject();

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: 'Test',
					caseSensitive: false,
					filePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Case-insensitive search - bbaiResponse:', result.bbaiResponse);
			// console.log('Case-insensitive search - toolResponse:', result.toolResponse);
			// console.log('Case-insensitive search - toolResults:', result.toolResults);

			assertStringIncludes(
				result.bbaiResponse,
				'BBai found 4 files matching the search criteria: content pattern "Test", case-insensitive, file pattern "regex_test*.txt"',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<files>');
			assertStringIncludes(toolResults, '</files>');

			const expectedFiles = ['regex_test1.txt', 'regex_test2.txt', 'regex_test3.txt', 'regex_test4.txt'];
			const fileContent = toolResults.split('<files>')[1].split('</files>')[0].trim();
			const foundFiles = fileContent.split('\n');

			expectedFiles.forEach((file) => {
				assert(foundFiles.some((f) => f.endsWith(file)), `File ${file} not found in the result`);
			});
			assert(foundFiles.length === expectedFiles.length, 'Number of found files does not match expected');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
