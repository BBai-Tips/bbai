import { ConfigManager, type WizardAnswers } from 'shared/configManager.ts';
import { assert } from '../deps.ts';
import { join } from '@std/path';

import ProjectEditor from '../../src/editor/projectEditor.ts';
import ProjectEditorManager from '../../src/editor/projectEditorManager.ts';
import LLMConversationInteraction from '../../src/llms/interactions/conversationInteraction.ts';

export async function setupTestProject(): Promise<string> {
	const testProjectRoot = Deno.makeTempDirSync();

	const wizardAnswers: WizardAnswers = { project: { name: 'TestProject', type: 'local' } };
	const configManager = await ConfigManager.getInstance();
	await configManager.ensureGlobalConfig();
	await configManager.ensureProjectConfig(testProjectRoot, wizardAnswers);

	return testProjectRoot;
}

export function cleanupTestProject(testProjectRoot: string) {
	try {
		Deno.removeSync(testProjectRoot, { recursive: true });
	} catch (error) {
		console.error(`Failed to clean up test directory: ${error}`);
	}
}

export async function getProjectEditor(projectRoot: string): Promise<ProjectEditor> {
	const projectEditorManager = new ProjectEditorManager();
	const projectEditor = await projectEditorManager.getOrCreateEditor('test-conversation', projectRoot);

	assert(projectEditor, 'Failed to get ProjectEditor');

	return projectEditor;
}

// Ensure all file paths are relative to testProjectRoot
export const getTestFilePath = (testProjectRoot: string, filename: string) => join(testProjectRoot, filename);

export async function createTestInteraction(
	conversationId: string,
	projectEditor: ProjectEditor,
): Promise<LLMConversationInteraction> {
	const interaction = await projectEditor.initConversation(conversationId);
	return interaction as LLMConversationInteraction;
}

export async function withTestProject<T>(
	testFn: (projectRoot: string) => Promise<T>,
): Promise<T> {
	const testProjectRoot = await setupTestProject();
	try {
		return await testFn(testProjectRoot);
	} finally {
		cleanupTestProject(testProjectRoot);
	}
}
