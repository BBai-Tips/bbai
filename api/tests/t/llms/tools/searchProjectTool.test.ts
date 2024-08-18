import { assert, assertEquals, assertRejects, assertStringIncludes } from '../../../deps.ts';
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

/*
function cleanupTestDirectory() {
	for (const entry of Deno.readDirSync(testProjectRoot)) {
		Deno.removeSync(join(testProjectRoot, entry.name), { recursive: true });
	}
}
 */

function createTestFiles() {
	Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
	Deno.writeTextFileSync(join(testProjectRoot, 'file2.js'), 'console.log("Hello, JavaScript!");');
	Deno.mkdirSync(join(testProjectRoot, 'subdir'));
	Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file3.txt'), 'Hello from subdirectory!');
}

createTestFiles();

Deno.test({
	name: 'SearchProjectTool - Basic search functionality',
	fn: async () => {
		const tool = new LLMToolSearchProject();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'search_project',
			toolInput: {
				pattern: 'Hello',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai found 3 files matching the pattern "Hello"');
		assertStringIncludes(result.toolResponse, 'Found 3 files matching the pattern "Hello"');
		assertStringIncludes(
			result.toolResults as string,
			'3 files match the pattern "Hello"\n<files>\n./file1.txt\n./file2.js\n./subdir/file3.txt\n</files>',
		);
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
				pattern: 'Hello',
				file_pattern: '*.txt',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(
			result.bbaiResponse,
			'BBai found 2 files matching the pattern "Hello" with file pattern "*.txt"',
		);
		assertStringIncludes(
			result.toolResponse,
			'Found 2 files matching the pattern "Hello" with file pattern "*.txt"',
		);
		assertStringIncludes(
			result.toolResults as string,
			'2 files match the pattern "Hello" with file pattern "*.txt"\n<files>\n./file1.txt\n./subdir/file3.txt\n</files>',
		);
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
				pattern: 'NonexistentPattern',
			},
		};

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai found 0 files matching the pattern "NonexistentPattern"');
		assertStringIncludes(result.toolResponse, 'Found 0 files matching the pattern "NonexistentPattern"');
		assertStringIncludes(result.toolResults as string, '0 files match the pattern "NonexistentPattern"');
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
				pattern: '[', // Invalid regex pattern
			},
		};
		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai found 0 files matching the pattern "["');
		assertStringIncludes(result.toolResponse, 'Found 0 files matching the pattern "["');
		assertStringIncludes(result.toolResults as string, '0 files match the pattern "["');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
