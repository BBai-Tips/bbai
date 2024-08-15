import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';
import LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
import LLMConversationInteraction from '../llms/interactions/conversationInteraction.ts';
import ProjectEditor from '../editor/projectEditor.ts';
import { createFilePatchXmlString } from './patch.utils.ts';
import { GitUtils } from 'shared/git.ts';

export async function stageAndCommitAfterPatching(
	interaction: LLMConversationInteraction,
	projectRoot: string,
	patchedFiles: Set<string>,
	patchContents: Map<string, string>,
	projectEditor: ProjectEditor,
): Promise<void> {
	if (patchedFiles.size === 0) {
		return;
	}

	const commitMessage = await generateCommitMessage(interaction, patchedFiles, patchContents, projectEditor);
	const patchedFilesArray = Array.from(patchedFiles);

	try {
		await GitUtils.stageAndCommit(projectRoot, patchedFilesArray, commitMessage);
		logger.info(`Created commit for patched files: ${patchedFilesArray.join(', ')}`);
	} catch (error) {
		logger.error(`Failed to create commit: ${error.message}`);
	}
}

export async function generateCommitMessage(
	interaction: LLMConversationInteraction,
	patchedFiles: Set<string>,
	patchContents: Map<string, string>,
	projectEditor: ProjectEditor,
): Promise<string> {
	const patchedFilesArray = Array.from(patchedFiles);
	const fileCount = patchedFilesArray.length;
	const fileList = patchedFilesArray.map((file) => `- ${file}`).join('\n');
	const filePatchList = patchedFilesArray.map((file) => {
		const patchContent = patchContents.get(file) || '';
		return createFilePatchXmlString(file, patchContent);
	});

	const prompt = await projectEditor.orchestratorController.promptManager.getPrompt('gitCommitMessage', {
		patchedFiles: filePatchList,
	});
	const chat: LLMChatInteraction = await projectEditor.orchestratorController.createChatInteraction(
		interaction.id,
		'Generate Commit Message',
	);
	const response = await chat.chat(prompt);
	const contentPart = response.messageResponse.answerContent[0] as { type: 'text'; text: string };
	const msg = contentPart.text;

	return stripIndents`${msg}
        
        Applied patches from BBai to ${fileCount} file${fileCount > 1 ? 's' : ''}

        Files modified:
        ${fileList}
        `;
}
