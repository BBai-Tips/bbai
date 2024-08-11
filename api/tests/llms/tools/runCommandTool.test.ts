import { assert, assertEquals, assertRejects, assertStringIncludes } from '../../deps.ts';
import { join } from '@std/path';
import { stripIndents } from 'common-tags';

import { LLMToolRunCommand } from '../../../src/llms/tools/runCommandTool.ts';
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

function createTestFiles() {
	// Create a simple TypeScript file
	Deno.writeTextFileSync(join(testProjectRoot, 'test.ts'), `console.log("Hello, TypeScript!");`);

	// Create a test file
	Deno.writeTextFileSync(
		join(testProjectRoot, 'test_file.ts'),
		stripIndents`
			import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
			Deno.test("example test", () => {
				const x = 1 + 2;
				assertEquals(x, 3);
			});
		`,
	);

	// Create a deno.jsonc file with task definitions
	Deno.writeTextFileSync(
		join(testProjectRoot, 'deno.jsonc'),
		JSON.stringify(
			{
				tasks: {
					'tool:check-types': 'deno check test.ts',
					'tool:test': 'deno test test_file.ts',
					'tool:format': 'deno fmt test.ts',
				},
			},
			null,
			2,
		),
	);
}

createTestFiles();

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:check-types',
	fn: async () => {
		const tool = new LLMToolRunCommand();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'run_command',
			toolInput: {
				command: 'deno task tool:check-types',
			},
		};

		const result = await tool.runTool(toolUse, projectEditor);

		assertStringIncludes(result.toolResponse, 'Command executed with exit code: 0');
		assertStringIncludes(result.toolResponse, 'Output:');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:test',
	fn: async () => {
		const tool = new LLMToolRunCommand();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'run_command',
			toolInput: {
				command: 'deno task tool:test',
			},
		};

		const result = await tool.runTool(toolUse, projectEditor);

		assertStringIncludes(result.toolResponse, 'Command executed with exit code: 0');
		assertStringIncludes(result.toolResponse, 'Output:');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:format',
	fn: async () => {
		const tool = new LLMToolRunCommand();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'run_command',
			toolInput: {
				command: 'deno task tool:format',
			},
		};

		const result = await tool.runTool(toolUse, projectEditor);

		assertStringIncludes(result.toolResponse, 'Command executed with exit code: 0');
		assertStringIncludes(result.toolResponse, 'Output:');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute not allowed command',
	fn: async () => {
		const tool = new LLMToolRunCommand();

		const toolUse: LLMAnswerToolUse = {
			toolValidation: { validated: true, results: '' },
			toolUseId: 'test-id',
			toolName: 'run_command',
			toolInput: {
				command: 'echo',
				args: ['This command is not allowed'],
			},
		};
		const result = await tool.runTool(toolUse, projectEditor);

		assertStringIncludes(result.toolResponse, 'Command not allowed: echo');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
