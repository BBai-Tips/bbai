import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';

import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';

// Type guard function
function isApplyPatchResponse(
	response: unknown,
): response is {
	data: {
		modifiedFiles: string[];
		newFiles: string[];
	};
} {
	return (
		typeof response === 'object' &&
		response !== null &&
		'data' in response &&
		typeof (response as any).data === 'object' &&
		'modifiedFiles' in (response as any).data &&
		Array.isArray((response as any).data.modifiedFiles) &&
		'newFiles' in (response as any).data &&
		Array.isArray((response as any).data.newFiles)
	);
}

// Type guard to check if bbaiResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'ApplyPatchTool - Basic functionality',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('apply_patch');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
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
				// console.log('Basic functionality - bbaiResponse:', result.bbaiResponse);
				// console.log('Basic functionality - toolResponse:', result.toolResponse);
				// console.log('Basic functionality - toolResults:', result.toolResults);

				assert(
					result.bbaiResponse && typeof result.bbaiResponse === 'object',
					'bbaiResponse should be an object',
				);
				assert(
					isApplyPatchResponse(result.bbaiResponse),
					'bbaiResponse should have the correct structure for Tool',
				);

				if (isApplyPatchResponse(result.bbaiResponse)) {
					assertEquals(
						result.bbaiResponse.data.modifiedFiles.length,
						1,
						'Should have 1 successful patch results',
					);
					const testResult = result.bbaiResponse.data.modifiedFiles.find((r) => r === 'test.txt');

					assert(testResult, 'Should have a result for test.txt');

					assertEquals(testResult, 'test.txt', 'Test response should match "test.txt"');

					assertEquals(result.bbaiResponse.data.newFiles.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbaiResponse does not have the expected structure for Tool');
				}

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
				logChangeAndCommitStub.restore();
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

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('apply_patch');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
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
				// console.log('Patch affecting multiple files - bbaiResponse:', result.bbaiResponse);
				// console.log('Patch affecting multiple files - toolResponse:', result.toolResponse);
				// console.log('Patch affecting multiple files - toolResults:', result.toolResults);

				assert(
					result.bbaiResponse && typeof result.bbaiResponse === 'object',
					'bbaiResponse should be an object',
				);
				assert(
					isApplyPatchResponse(result.bbaiResponse),
					'bbaiResponse should have the correct structure for Tool',
				);

				if (isApplyPatchResponse(result.bbaiResponse)) {
					assertEquals(
						result.bbaiResponse.data.modifiedFiles.length,
						2,
						'Should have 2 successful patch results',
					);
					const testResult1 = result.bbaiResponse.data.modifiedFiles.find((r) => r === 'file1.txt');
					const testResult2 = result.bbaiResponse.data.modifiedFiles.find((r) => r === 'file2.txt');

					assert(testResult1, 'Should have a result for file1.txt');
					assert(testResult2, 'Should have a result for file2.txt');

					assertEquals(testResult1, 'file1.txt', 'Test response should match "file1.txt"');
					assertEquals(testResult2, 'file2.txt', 'Test response should match "file2.txt"');

					assertEquals(result.bbaiResponse.data.newFiles.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbaiResponse does not have the expected structure for Tool');
				}

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
				logChangeAndCommitStub.restore();
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

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('apply_patch');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
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
				// console.log('Complex patch with multiple changes - bbaiResponse:', result.bbaiResponse);
				// console.log('Complex patch with multiple changes - toolResponse:', result.toolResponse);
				// console.log('Complex patch with multiple changes - toolResults:', result.toolResults);

				assert(
					result.bbaiResponse && typeof result.bbaiResponse === 'object',
					'bbaiResponse should be an object',
				);
				assert(
					isApplyPatchResponse(result.bbaiResponse),
					'bbaiResponse should have the correct structure for Tool',
				);
				if (isApplyPatchResponse(result.bbaiResponse)) {
					assertEquals(
						result.bbaiResponse.data.modifiedFiles.length,
						1,
						'Should have 1 successful patch results',
					);
					const testResult = result.bbaiResponse.data.modifiedFiles.find((r) => r === 'complex.txt');

					assert(testResult, 'Should have a result for complex.txt');

					assertEquals(testResult, 'complex.txt', 'Test response should match "complex.txt"');

					assertEquals(result.bbaiResponse.data.newFiles.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbaiResponse does not have the expected structure for Tool');
				}

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
				logChangeAndCommitStub.restore();
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

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('apply_patch');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
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
				// console.log('Create new file - bbaiResponse:', result.bbaiResponse);
				// console.log('Create new file - toolResponse:', result.toolResponse);
				// console.log('Create new file - toolResults:', result.toolResults);

				assert(
					result.bbaiResponse && typeof result.bbaiResponse === 'object',
					'bbaiResponse should be an object',
				);
				assert(
					isApplyPatchResponse(result.bbaiResponse),
					'bbaiResponse should have the correct structure for Tool',
				);
				if (isApplyPatchResponse(result.bbaiResponse)) {
					assertEquals(
						result.bbaiResponse.data.newFiles.length,
						1,
						'Should have 1 successful patch results',
					);
					const testResult = result.bbaiResponse.data.newFiles.find((r) => r === 'new_file.txt');

					assert(testResult, 'Should have a result for new_file.txt');

					assertEquals(testResult, 'new_file.txt', 'Test response should match "new_file.txt"');

					assertEquals(result.bbaiResponse.data.modifiedFiles.length, 0, 'Should have no modified files');
				} else {
					assert(false, 'bbaiResponse does not have the expected structure for Tool');
				}

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
				logChangeAndCommitStub.restore();
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

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('apply_patch');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
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
				// console.log('Attempt to patch file outside project root - bbaiResponse:', result.bbaiResponse);
				// console.log('Attempt to patch file outside project root - toolResponse:', result.toolResponse);
				// console.log('Attempt to patch file outside project root - toolResults:', result.toolResults);

				assert(isString(result.bbaiResponse), 'bbaiResponse should be a string');

				if (isString(result.bbaiResponse)) {
					assertStringIncludes(
						result.bbaiResponse,
						'BBai failed to apply patch. Error: Failed to apply patch: Access denied: ../outside_project.txt is outside the project directory',
					);
				} else {
					assert(false, 'bbaiResponse is not a string as expected');
				}

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
				logChangeAndCommitStub.restore();
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

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('apply_patch');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
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
				// console.log('Patch fails to apply - bbaiResponse:', result.bbaiResponse);
				// console.log('Patch fails to apply - toolResponse:', result.toolResponse);
				// console.log('Patch fails to apply - toolResults:', result.toolResults);

				assert(isString(result.bbaiResponse), 'bbaiResponse should be a string');

				if (isString(result.bbaiResponse)) {
					assertStringIncludes(
						result.bbaiResponse,
						'BBai failed to apply patch. Error: Failed to apply patch: Failed to apply patch to mismatch.txt. The patch does not match the current file content. Consider using the `search_and_replace` tool for more precise modifications',
					);
				} else {
					assert(false, 'bbaiResponse is not a string as expected');
				}

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
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
