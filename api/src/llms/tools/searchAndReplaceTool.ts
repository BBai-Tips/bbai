import LLMTool, { LLMToolInputSchema, LLMToolRunResult } from '../llmTool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../../errors/error.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { ConversationPersistence } from '../../utils/conversationPersistence.utils.ts';
import { logger } from 'shared/logger.ts';
import { join } from '@std/path';

export class LLMToolSearchAndReplace extends LLMTool {
	constructor() {
		super(
			'search_and_replace',
			'Apply a list of search and replace operations to a file',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'The path of the file to be modified or created',
				},
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							search: {
								type: 'string',
								description:
									'The exact literal text to search for, with all leading and trailing whitespace from the original file',
							},
							replace: {
								type: 'string',
								description:
									'The text to replace with, matching the same indent level as the original file',
							},
						},
						required: ['search', 'replace'],
					},
					description: 'List of literal search and replace operations to apply',
				},
				createIfMissing: {
					type: 'boolean',
					description: 'Create the file if it does not exist',
				},
			},
			required: ['filePath', 'operations'],
		};
	}

	async runTool(
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { filePath, operations, createIfMissing = false } = toolInput as {
			filePath: string;
			operations: Array<{ search: string; replace: string }>;
			createIfMissing?: boolean;
		};

		if (!await isPathWithinProject(projectEditor.projectRoot, filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				name: 'search-and-replace',
				filePath,
				operation: 'search-replace',
			} as FileHandlingErrorOptions);
		}

		const fullFilePath = join(projectEditor.projectRoot, filePath);
		logger.info(`Handling search and replace for file: ${fullFilePath}`);

		try {
			let content: string;
			let fileCreated = false;
			try {
				content = await Deno.readTextFile(fullFilePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					content = '';
					fileCreated = true;
					logger.info(`File ${fullFilePath} not found. Creating new file.`);
				} else {
					throw error;
				}
			}

			let changesMade = false;
			let allOperationsSkipped = true;
			const toolWarnings = [];
			for (const operation of operations) {
				const { search, replace } = operation;

				// Validate that search and replace strings are different
				if (search === replace) {
					const warningMessage = `Warning: Search and replace strings are identical for operation: ${
						JSON.stringify(operation)
					}. Operation skipped.`;
					logger.warn(warningMessage);
					toolWarnings.push(warningMessage);
					continue; // Skip this operation
				}

				const originalContent = content;
				content = content.replaceAll(search, replace);

				// Check if the content actually changed
				if (content !== originalContent) {
					changesMade = true;
					allOperationsSkipped = false;
				}
			}
			let toolWarning = '';
			if (toolWarnings.length > 0) {
				toolWarning = `Tool Use Warnings: \n${toolWarnings.join('\n')}\n`;
			}

			if (changesMade || fileCreated) {
				await Deno.writeTextFile(fullFilePath, content);
				projectEditor.patchedFiles.add(filePath);
				projectEditor.patchContents.set(filePath, JSON.stringify(operations));

				// Log the applied changes
				if (projectEditor.conversation) {
					logger.info(`Saving conversation search and replace: ${projectEditor.conversation.id}`);
					const persistence = new ConversationPersistence(projectEditor.conversation.id, projectEditor);
					await persistence.logPatch(filePath, JSON.stringify(operations));
					await projectEditor.stageAndCommitAfterPatching();
				}
				const { messageId, toolResponse } = projectEditor.toolManager.finalizeToolUse(
					toolUse,
					fileCreated
						? `File created and search and replace operations applied successfully to file: ${filePath}`
						: `Search and replace operations applied successfully to file: ${filePath}`,
					false,
					projectEditor,
				);

				const bbaiResponse = `BBai applied search and replace operations: ${toolWarning}`;
				return { messageId, toolResponse, bbaiResponse };
			} else {
				const noChangesMessage = allOperationsSkipped
					? `${toolWarning}No changes were made to the file: ${filePath}. All operations were skipped due to identical search and replace strings.`
					: `${toolWarning}No changes were made to the file: ${filePath}. The search strings were not found in the file content.`;
				logger.info(noChangesMessage);

				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'search-and-replace',
					filePath: filePath,
					operation: 'search-replace',
				} as FileHandlingErrorOptions);
			}
		} catch (error) {
			if (error.name === 'search-and-replace') {
				throw error;
			}
			let errorMessage = `Failed to apply search and replace to ${filePath}: ${error.message}`;
			logger.error(errorMessage);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'search-and-replace',
				filePath: filePath,
				operation: 'search-replace',
			} as FileHandlingErrorOptions);
		}
	}
}
