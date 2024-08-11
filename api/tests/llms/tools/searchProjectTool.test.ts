import { assert, assertEquals, assertRejects } from '../../deps.ts';
import { join } from '@std/path';

import { LLMToolSearchProject } from '../../../src/llms/tools/searchProjectTool.ts';
import ProjectEditor from '../../../src/editor/projectEditor.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';

const projectEditor = await getProjectEditor(Deno.makeTempDirSync());
const testProjectRoot = projectEditor.projectRoot;
console.log('Project editor root:', testProjectRoot);

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

		const result = await tool.runTool(toolUse, projectEditor);

		assert(result.bbaiResponse.includes('BBai found 3 files matching the pattern'));
		assert(result.toolResponse.includes('3 files match the pattern'));
		assert(result.toolResponse.includes('file1.txt'));
		assert(result.toolResponse.includes('file2.js'));
		assert(result.toolResponse.includes('subdir/file3.txt'));
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

		const result = await tool.runTool(toolUse, projectEditor);

		assertEquals(result.bbaiResponse.includes('BBai found 2 files matching the pattern'), true);
		assertEquals(result.toolResponse.includes('2 files match the pattern'), true);
		assertEquals(result.toolResponse.includes('file1.txt'), true);
		assertEquals(result.toolResponse.includes('subdir/file3.txt'), true);
		assertEquals(result.toolResponse.includes('file2.js'), false);
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

		const result = await tool.runTool(toolUse, projectEditor);

		assert(result.toolResponse.includes('Tool search_project executed successfully'));
		assert(result.bbaiResponse.includes('BBai found 0 files matching the pattern'));
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
		const result = await tool.runTool(toolUse, projectEditor);

		assert(result.toolResponse.includes('Tool search_project failed to run:'));
		assert(result.toolResponse.includes('Error: grep: brackets ([ ]) not balanced'));
		assert(result.bbaiResponse.includes('BBai found 0 files matching the pattern'));
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
