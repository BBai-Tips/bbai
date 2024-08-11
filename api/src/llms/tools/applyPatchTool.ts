import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../../errors/error.ts';
import { ConversationPersistence } from '../../utils/conversationPersistence.utils.ts';
import { logger } from 'shared/logger.ts';
import { dirname, join } from '@std/path';
import { ensureDir } from '@std/fs';
import * as diff from 'diff';

export class LLMToolApplyPatch extends LLMTool {
	constructor() {
		super(
			'apply_patch',
			'Apply a well-formed patch to a file',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'The path of the file to be patched',
				},
				patch: {
					type: 'string',
					description: 'The carefully written and well-formed patch to be applied in unified diff format',
				},
			},
			required: ['filePath', 'patch'],
		};
	}

	async runTool(
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;

		const { filePath, patch } = toolInput as { filePath: string; patch: string };

		if (!await isPathWithinProject(projectEditor.projectRoot, filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				name: 'apply-patch',
				filePath,
				operation: 'patch',
			} as FileHandlingErrorOptions);
		}

		const fullFilePath = join(projectEditor.projectRoot, filePath);
		logger.info(`Handling patch for file: ${fullFilePath}\nWith patch:\n${patch}`);

		try {
			const parsedPatch = diff.parsePatch(patch);

			for (const patchPart of parsedPatch) {
				if (patchPart.oldFileName === '/dev/null') {
					// This is a new file
					const newFilePath = patchPart.newFileName
						? join(projectEditor.projectRoot, patchPart.newFileName)
						: undefined;
					if (!newFilePath) {
						throw new Error('New file path is undefined');
					}

					projectEditor.patchedFiles.add(newFilePath);
					projectEditor.patchContents.set(newFilePath, patch);

					const newFileContent = patchPart.hunks.map((h) =>
						h.lines.filter((l) => l[0] === '+').map((l) => l.slice(1)).join('\n')
					).join('\n');

					await ensureDir(dirname(newFilePath));
					await Deno.writeTextFile(newFilePath, newFileContent);
					logger.info(`Created new file: ${patchPart.newFileName}`);
				} else {
					projectEditor.patchedFiles.add(filePath);
					projectEditor.patchContents.set(filePath, patch);
					// Existing file, apply patch as before
					const currentContent = await Deno.readTextFile(fullFilePath);

					const patchedContent = diff.applyPatch(currentContent, patchPart, {
						fuzzFactor: 2,
					});

					if (patchedContent === false) {
						const errorMessage =
							'Failed to apply patch. The patch does not match the current file content. ' +
							'Consider using the `search_and_replace` tool for more precise modifications.';
						throw createError(ErrorType.FileHandling, errorMessage, {
							name: 'apply-patch',
							filePath,
							operation: 'patch',
						} as FileHandlingErrorOptions);
					}

					await Deno.writeTextFile(fullFilePath, patchedContent);
					logger.info(`Patch applied to existing file: ${filePath}`);
				}
			}

			// Log the applied patch
			if (projectEditor.conversation) {
				logger.info(`Saving conversation patch: ${projectEditor.conversation.id}`);
				const persistence = new ConversationPersistence(projectEditor.conversation.id, projectEditor);
				await persistence.logPatch(filePath, patch);
				await projectEditor.stageAndCommitAfterPatching();
			}
			const { messageId, toolResponse } = projectEditor.toolManager.finalizeToolUse(
				toolUse,
				`Patch applied to file: ${filePath}`,
				false,
				projectEditor,
			);
			const bbaiResponse = `BBai has applied patch successfully to file: ${filePath}`;
			return { messageId, toolResponse, bbaiResponse };
		} catch (error) {
			let errorMessage: string;
			if (error instanceof Deno.errors.NotFound) {
				errorMessage = `File not found: ${filePath}`;
			} else if (error instanceof Deno.errors.PermissionDenied) {
				errorMessage = `Permission denied for file: ${filePath}`;
			} else {
				errorMessage = `Failed to apply patch to ${filePath}: ${error.message}`;
			}
			logger.error(errorMessage);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'apply-patch',
				filePath: filePath,
				operation: 'patch',
			} as FileHandlingErrorOptions);
		}
	}
}
