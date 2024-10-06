import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';

import LLMToolRewriteFile from '../tool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getTestFilePath, withTestProject } from 'api/tests/testSetup.ts';

Deno.test({
	name: 'Rewrite File Tool - rewrite existing file',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const tool = new LLMToolRewriteFile();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file
				const testFile = 'test.txt';
				const testFilePath = getTestFilePath(testProjectRoot, testFile);
				await Deno.writeTextFile(testFilePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'New content',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(result.bbaiResponse, `BBai rewrote file: test.txt`);
				assertStringIncludes(result.toolResponse, `Rewrote existing file`);
				assertStringIncludes(result.toolResults as string, `File ${testFile} rewritten with new contents`);

				const newContent = await Deno.readTextFile(testFilePath);
				assertEquals(newContent, 'New content');
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Rewrite File Tool - create new file',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const tool = new LLMToolRewriteFile();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file
				const testFile = 'new-test.txt';
				const testFilePath = getTestFilePath(testProjectRoot, testFile);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'New file content',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(result.bbaiResponse, `BBai created file: new-test.txt`);
				assertStringIncludes(result.toolResponse, `Created a new file`);
				assertStringIncludes(result.toolResults as string, `File ${testFile} created with new contents`);

				assert(await Deno.stat(testFilePath));

				const newContent = await Deno.readTextFile(testFilePath);
				assertEquals(newContent, 'New file content');
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

/*
Deno.test({
	name: 'Rewrite File Tool - throw error for file outside project',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(projectEditor.orchestratorController);

			const tool = new LLMToolRewriteFile();

			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() => Promise.resolve());
			try {
				// Create a test file
				const testFile = '/tmp/outside_project.txt';
				//const testFilePath = '/tmp/outside_project.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'New content',
					},
				};

				assertThrows(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					`Access denied: ${testFile} is outside the project directory`,
				);
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
 */
