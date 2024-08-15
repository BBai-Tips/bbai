import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import ConversationPersistence from '../../storage/conversationPersistence.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../../errors/error.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { logger } from 'shared/logger.ts';
import { ensureDir } from '@std/fs';
import { dirname, join } from '@std/path';

export class LLMToolRewriteFile extends LLMTool {
	constructor() {
		super(
			'rewrite_file',
			'Rewrite an entire file or create a new one',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: { type: 'string', description: 'The path of the file to be rewritten or created' },
				content: { type: 'string', description: 'The new content of the file' },
				createIfMissing: {
					type: 'boolean',
					description: 'Create the file if it does not exist',
					default: true,
				},
			},
			required: ['filePath', 'content'],
		};
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { filePath, content, createIfMissing = true } = toolInput as {
			filePath: string;
			content: string;
			createIfMissing?: boolean;
		};

		if (!await isPathWithinProject(projectEditor.projectRoot, filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				name: 'rewrite-file',
				filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}

		const fullFilePath = join(projectEditor.projectRoot, filePath);
		logger.info(`Handling rewrite for file: ${fullFilePath}`);

		try {
			let isNewFile = false;
			try {
				await Deno.stat(fullFilePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					isNewFile = true;
					logger.info(`File ${fullFilePath} not found. Creating new file.`);
					// Create missing directories
					await ensureDir(dirname(fullFilePath));
					logger.info(`Created directory structure for ${fullFilePath}`);
				} else {
					throw error;
				}
			}

			if (!content) {
				const noChangesMessage =
					`No changes were made to the file: ${filePath}. The content for the file is empty.`;
				logger.info(noChangesMessage);
				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'rewrite-file',
					filePath: filePath,
					operation: 'rewrite-file',
				} as FileHandlingErrorOptions);
			}

			await Deno.writeTextFile(fullFilePath, content);
			projectEditor.patchedFiles.add(filePath);
			projectEditor.patchContents.set(filePath, JSON.stringify(content));

			// Log the applied changes
			if (interaction) {
				logger.info(`Saving conversation rewrite file: ${interaction.id}`);
				const persistence = new ConversationPersistence(interaction.id, projectEditor);
				await persistence.logPatch(filePath, JSON.stringify(content));
				await projectEditor.orchestratorController.stageAndCommitAfterPatching(interaction);
			}

			const { messageId, toolResponse } = projectEditor.orchestratorController.toolManager.finalizeToolUse(
				interaction,
				toolUse,
				isNewFile
					? `File created and contents written successfully to file: ${filePath}`
					: `Contents written successfully to file: ${filePath}`,
				false,
				//projectEditor,
			);

			const bbaiResponse = `BBai applied file contents to: ${filePath}`;
			return { messageId, toolResponse, bbaiResponse };
		} catch (error) {
			if (error.name === 'rewrite-file') {
				throw error;
			}
			let errorMessage = `Failed to write contents to ${filePath}: ${error.message}`;
			logger.error(errorMessage);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-file',
				filePath: filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}
	}
}
