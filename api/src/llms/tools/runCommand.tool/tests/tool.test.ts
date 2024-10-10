import { assert, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { stripIndents } from 'common-tags';
import { stripAnsiCode } from '@std/fmt/colors';

import LLMToolRunCommand from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

function createTestFiles(testProjectRoot: string) {
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
					'tool:check-types-project': 'deno check test.ts',
					'tool:check-types-args': 'deno check test.ts',
					'tool:test': 'deno test test_file.ts',
					'tool:format': 'deno fmt test.ts',
				},
			},
			null,
			2,
		),
	);
}

const toolConfig = {
	allowedCommands: [
		'deno task tool:check-types-project',
		'deno task tool:check-types-args',
		'deno task tool:test',
		'deno task tool:format',
	],
};

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:check-types',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'deno task tool:check-types-args',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Execute allowed command: deno task tool:check-types - bbaiResponse:', result.bbaiResponse);
			// console.log('Execute allowed command: deno task tool:check-types - toolResponse:', result.toolResponse);
			// console.log('Execute allowed command: deno task tool:check-types - toolResults:', result.toolResults);

			assertStringIncludes(result.bbaiResponse, 'BBai ran command: deno task tool:check-types-args');
			assertStringIncludes(result.toolResponse, 'Command completed successfully');
			assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Error output:\nTask tool:check-types-args deno check test.ts',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:test',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

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
			// console.log('Execute allowed command: deno task tool:test - bbaiResponse:', result.bbaiResponse);
			// console.log('Execute allowed command: deno task tool:test - toolResponse:', result.toolResponse);
			// console.log('Execute allowed command: deno task tool:test - toolResults:', result.toolResults);

			assertStringIncludes(result.bbaiResponse, 'BBai ran command: deno task tool:test');
			assertStringIncludes(result.toolResponse, 'Command completed successfully');
			assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Output:\nrunning 1 test from ./test_file.ts\nexample test ... ok',
			);
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Error output:\nTask tool:test deno test test_file.ts',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:format',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

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
			assertStringIncludes(result.toolResponse, 'Command completed successfully');
			assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Output:\n\n',
			);
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Error output:\nTask tool:format deno fmt test.ts',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute not allowed command',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
