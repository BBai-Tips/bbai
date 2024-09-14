import { assert, assertEquals, assertStringIncludes } from '../../../deps.ts';

import LLMToolApplyPatch from '../../../../src/llms/tools/applyPatchTool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from '../../../lib/stubs.ts';
import { createTestInteraction, getProjectEditor, getTestFilePath, withTestProject } from '../../../lib/testSetup.ts';

Deno.test({
	name: 'ApplyPatchTool - Basic functionality',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const tool = new LLMToolApplyPatch();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file
				const testFile = 'test.txt';
				const testFilePath = getTestFilePath(testProjectRoot, testFile);
				await Deno.writeTextFile(testFilePath, 'Hello, world!');

				const patch = `
--- test.txt
+++ test.txt
@@ -1 +1 @@
-Hello, world!
+Hello, Deno!
`;

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'apply_patch',
					toolInput: {
						filePath: testFile,
						patch: patch,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(
					result.bbaiResponse,
					'BBai has applied patch successfully to 1 file(s)',
				);
				assertStringIncludes(result.toolResponse, 'Applied patch successfully to 1 file(s)');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 2, 'toolResults should have 2 element');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, '✅ Patch applied successfully to 1 file(s)');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(secondResult.text, '📝 Modified: test.txt');

				const updatedContent = await Deno.readTextFile(testFilePath);
				assertEquals(updatedContent, 'Hello, Deno!');
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ApplyPatchTool - Patch affecting multiple files',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const tool = new LLMToolApplyPatch();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create two test files
				const testFile1 = 'file1.txt';
				const testFile2 = 'file2.txt';
				const testFilePath1 = getTestFilePath(testProjectRoot, testFile1);
				const testFilePath2 = getTestFilePath(testProjectRoot, testFile2);
				await Deno.writeTextFile(testFilePath1, 'Content of file 1');
				await Deno.writeTextFile(testFilePath2, 'Content of file 2');

				const patch = `
--- file1.txt
+++ file1.txt
@@ -1 +1 @@
-Content of file 1
+Updated content of file 1
--- file2.txt
+++ file2.txt
@@ -1 +1,2 @@
 Content of file 2
+New line in file 2
`;

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'apply_patch',
					toolInput: {
						patch: patch,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(
					result.bbaiResponse,
					'BBai has applied patch successfully to 2 file(s)',
				);
				assertStringIncludes(result.toolResponse, 'Applied patch successfully to 2 file(s)');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, '✅ Patch applied successfully to 2 file(s)');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(secondResult.text, '📝 Modified: file1.txt');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Third result should be of type text');
				assertStringIncludes(thirdResult.text, '📝 Modified: file2.txt');

				// Verify content of file1.txt
				const updatedContent1 = await Deno.readTextFile(testFilePath1);
				assertEquals(updatedContent1, 'Updated content of file 1');

				// Verify content of file2.txt
				const updatedContent2 = await Deno.readTextFile(testFilePath2);
				assertEquals(updatedContent2, 'Content of file 2\nNew line in file 2');
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ApplyPatchTool - Complex patch with multiple changes',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const tool = new LLMToolApplyPatch();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file with multiple lines
				const testFile = 'complex.txt';
				const testFilePath = getTestFilePath(testProjectRoot, testFile);
				await Deno.writeTextFile(testFilePath, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

				const patch = `
--- complex.txt
+++ complex.txt
@@ -1,5 +1,6 @@
 Line 1
-Line 2
-Line 3
+Modified Line 2
+New Line
 Line 4
-Line 5
+Modified Line 5
+Another New Line
`;

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'apply_patch',
					toolInput: {
						filePath: testFile,
						patch: patch,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(
					result.bbaiResponse,
					'BBai has applied patch successfully to 1 file(s)',
				);
				assertStringIncludes(result.toolResponse, 'Applied patch successfully to 1 file(s)');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 2, 'toolResults should have 2 element');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, '✅ Patch applied successfully to 1 file(s)');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(secondResult.text, '📝 Modified: complex.txt');

				const updatedContent = await Deno.readTextFile(testFilePath);
				assertEquals(
					updatedContent,
					'Line 1\nModified Line 2\nNew Line\nLine 4\nModified Line 5\nAnother New Line',
				);
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ApplyPatchTool - Create new file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const tool = new LLMToolApplyPatch();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const newFile = 'new_file.txt';
				const newFilePath = getTestFilePath(testProjectRoot, newFile);

				const patch = `
--- /dev/null
+++ new_file.txt
@@ -0,0 +1 @@
+This is a new file created by patch.
`;

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'apply_patch',
					toolInput: {
						filePath: newFile,
						patch: patch,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(
					result.bbaiResponse,
					'BBai has applied patch successfully to 1 file(s)',
				);
				assertStringIncludes(result.toolResponse, 'Applied patch successfully to 1 file(s)');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 2, 'toolResults should have 2 element');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, '✅ Patch applied successfully to 1 file(s)');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(secondResult.text, '📄 Created: new_file.txt');

				const fileContent = await Deno.readTextFile(newFilePath);
				assertEquals(fileContent, 'This is a new file created by patch.');
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ApplyPatchTool - Attempt to patch file outside project root',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const tool = new LLMToolApplyPatch();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testFile = '../outside_project.txt';

				const patch = `
--- ../outside_project.txt
+++ ../outside_project.txt
@@ -1 +1 @@
-This should not be patched
+This should not be allowed
`;

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'apply_patch',
					toolInput: {
						filePath: testFile,
						patch: patch,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(
					result.bbaiResponse,
					'BBai failed to apply patch. Error: Failed to apply patch: Access denied: ../outside_project.txt is outside the project directory',
				);
				assertStringIncludes(
					result.toolResponse,
					'Failed to apply patch. Error: Failed to apply patch: Access denied: ../outside_project.txt is outside the project directory',
				);

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 1, 'toolResults should have 1 element');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					'⚠️  Failed to apply patch: Access denied: ../outside_project.txt is outside the project directory',
				);
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ApplyPatchTool - Patch fails to apply',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const tool = new LLMToolApplyPatch();
			const logPatchAndCommitStub = orchestratorControllerStubMaker.logPatchAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file with multiple lines
				const testFile = 'mismatch.txt';
				const testFilePath = getTestFilePath(testProjectRoot, testFile);
				await Deno.writeTextFile(
					testFilePath,
					'Line 1: This is the original content\nLine 2: It has multiple lines\nLine 3: To make it harder to match\nLine 4: Even with fuzz factor\nLine 5: This should ensure failure',
				);

				const patch = `
--- mismatch.txt
+++ mismatch.txt
@@ -1,5 +1,5 @@
-Line 1: Hello, world!
-Line 2: This is a test
-Line 3: Of a multi-line file
-Line 4: That should not match
-Line 5: The original content
+Line 1: Hello, Deno!
+Line 2: This is an updated test
+Line 3: With different content
+Line 4: That won't match the original
+Line 5: Even with fuzz factor
`;

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'apply_patch',
					toolInput: {
						filePath: testFile,
						patch: patch,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(
					result.bbaiResponse,
					'BBai failed to apply patch. Error: Failed to apply patch:',
				);
				assertStringIncludes(result.toolResponse, 'Failed to apply patch. Error: Failed to apply patch:');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 1, 'toolResults should have 1 element');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, '⚠️  Failed to apply patch:');

				// Verify that the file content hasn't changed
				const unchangedContent = await Deno.readTextFile(testFilePath);
				assertEquals(
					unchangedContent,
					'Line 1: This is the original content\nLine 2: It has multiple lines\nLine 3: To make it harder to match\nLine 4: Even with fuzz factor\nLine 5: This should ensure failure',
				);
			} finally {
				logPatchAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
