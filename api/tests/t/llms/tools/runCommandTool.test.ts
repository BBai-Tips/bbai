import { assert, assertEquals, assertRejects, assertStringIncludes } from '../../../deps.ts';
import { join } from '@std/path';
import { stripIndents } from 'common-tags';
import { stripAnsiCode } from '@std/fmt/colors';

import { LLMToolRunCommand } from '../../../../src/llms/tools/runCommandTool.ts';
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

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai ran command: deno task tool:check-types');
		assertStringIncludes(result.toolResponse, 'Command ran with errors');
		assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
		assertStringIncludes(
			stripAnsiCode(result.toolResults as string),
			'Error output:\nTask tool:check-types deno check test.ts',
		);
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

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai ran command: deno task tool:test');
		assertStringIncludes(result.toolResponse, 'Command ran with errors');
		assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
		assertStringIncludes(
			stripAnsiCode(result.toolResults as string),
			'Output:\nrunning 1 test from ./test_file.ts\nexample test ... ok',
		);
		assertStringIncludes(
			stripAnsiCode(result.toolResults as string),
			'Error output:\nTask tool:test deno test test_file.ts',
		);
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

		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, 'BBai ran command: deno task tool:format');
		assertStringIncludes(result.toolResponse, 'Command ran with errors');
		assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
		assertStringIncludes(
			stripAnsiCode(result.toolResults as string),
			'Output:\n\n',
		);
		assertStringIncludes(
			stripAnsiCode(result.toolResults as string),
			'Error output:\nTask tool:format deno fmt test.ts',
		);
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
		const conversation = await projectEditor.initConversation('test-conversation-id');
		const result = await tool.runTool(conversation, toolUse, projectEditor);

		assertStringIncludes(result.bbaiResponse, "BBai won't run unapproved commands: echo");
		assertStringIncludes(result.toolResponse, 'Command not allowed: echo');
		assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command not allowed: echo');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
