import LLMTool, {
	LLMToolFormatterDestination,
	LLMToolInputSchema,
	LLMToolRunResult,
	LLMToolRunResultContent,
	LLMToolRunResultFormatter,
	LLMToolUseInputFormatter,
} from 'api/llms/llmTool.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import {
	LLMAnswerToolUse,
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../../errors/error.ts';
import { logger } from 'shared/logger.ts';
import { dirname, join } from '@std/path';
import { ensureDir } from '@std/fs';
import * as diff from 'diff';

export class LLMToolApplyPatch extends LLMTool {
	constructor() {
		super(
			'apply_patch',
			'Apply a well-formed patch to one or more files',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'The path of the file to be patched. Optional for multi-file patches.',
				},
				patch: {
					type: 'string',
					description: 'The carefully written and well-formed patch to be applied in unified diff format',
				},
			},
			required: ['patch'],
		};
	}

	toolUseInputFormatter: LLMToolUseInputFormatter = (
		toolInput: LLMToolInputSchema,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const { filePath, patch } = toolInput as { filePath?: string; patch: string };
		if (format === 'console') {
			return stripIndents`
				${
				filePath ? `${colors.bold('File to patch:')} ${colors.cyan(filePath)}` : colors.bold('Multi-file patch')
			}
				
				${colors.bold('Patch:')}\n${colors.yellow(patch)}
			`;
		} else if (format === 'browser') {
			return `
				${
				filePath
					? `<p><strong>File to patch:</strong> <span style="color: #4169E1;">${filePath}</span></p>`
					: '<p><strong>Multi-file patch</strong></p>'
			}
				<p><strong>Patch:</strong></p>
				<pre style="background-color: #FFFACD; padding: 10px;">${patch}</pre>
			`;
		}
		return JSON.stringify(toolInput, null, 2);
	};

	toolRunResultFormatter: LLMToolRunResultFormatter = (
		toolResult: LLMToolRunResultContent,
		format: LLMToolFormatterDestination = 'console',
	): string => {
		const results: LLMMessageContentParts = Array.isArray(toolResult)
			? toolResult
			: [toolResult as LLMMessageContentPart];
		let formattedResult = '';

		results.forEach((result: LLMMessageContentPart) => {
			if (result.type === 'text') {
				if (format === 'console') {
					formattedResult += `${colors.bold(result.text)}\n`;
				} else if (format === 'browser') {
					formattedResult += `<p><strong>${result.text}</strong></p>`;
				} else {
					formattedResult += `${result.text}\n`;
				}
			} else {
				formattedResult += `Unknown type: ${result.type}\n`;
			}
		});

		return formattedResult.trim();
	};

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { filePath, patch } = toolInput as { filePath?: string; patch: string };

		const parsedPatch = diff.parsePatch(patch);
		const modifiedFiles: string[] = [];
		const newFiles: string[] = [];

		try {
			for (const patchPart of parsedPatch) {
				const currentFilePath = patchPart.newFileName || filePath;
				if (!currentFilePath) {
					throw new Error('File path is undefined');
				}
				logger.info(`Checking location of file: ${currentFilePath}`);

				if (!await isPathWithinProject(projectEditor.projectRoot, currentFilePath)) {
					throw createError(
						ErrorType.FileHandling,
						`Access denied: ${currentFilePath} is outside the project directory`,
						{
							name: 'apply-patch',
							filePath: currentFilePath,
							operation: 'apply-patch',
						} as FileHandlingErrorOptions,
					);
				}

				const fullFilePath = join(projectEditor.projectRoot, currentFilePath);

				if (patchPart.oldFileName === '/dev/null') {
					// This is a new file
					newFiles.push(currentFilePath);
					const newFileContent = patchPart.hunks.map((h) =>
						h.lines.filter((l) => l[0] === '+').map((l) => l.slice(1)).join('\n')
					).join('\n');

					await ensureDir(dirname(fullFilePath));
					await Deno.writeTextFile(fullFilePath, newFileContent);
					logger.info(`Created new file: ${currentFilePath}`);
				} else {
					// Existing file, apply patch
					modifiedFiles.push(currentFilePath);
					const currentContent = await Deno.readTextFile(fullFilePath);

					const patchedContent = diff.applyPatch(currentContent, patchPart, {
						fuzzFactor: 2,
					});

					if (patchedContent === false) {
						const errorMessage =
							`Failed to apply patch to ${currentFilePath}. The patch does not match the current file content. ` +
							'Consider using the `search_and_replace` tool for more precise modifications.';
						throw createError(ErrorType.FileHandling, errorMessage, {
							name: 'apply-patch',
							filePath: currentFilePath,
							operation: 'patch',
						} as FileHandlingErrorOptions);
					}

					await Deno.writeTextFile(fullFilePath, patchedContent);
					logger.info(`Patch applied to existing file: ${currentFilePath}`);
				}

				projectEditor.patchedFiles.add(currentFilePath);
				projectEditor.patchContents.set(currentFilePath, patch);
			}

			// Log patch and commit for all modified files
			for (const file of [...modifiedFiles, ...newFiles]) {
				await projectEditor.orchestratorController.logPatchAndCommit(
					interaction,
					file,
					patch,
				);
			}

			const toolResultContentParts: LLMMessageContentParts = [
				{
					type: 'text',
					text: `✅ Patch applied successfully to ${modifiedFiles.length + newFiles.length} file(s)`,
				},
				...modifiedFiles.map((
					file,
				) => ({ type: 'text', text: `📝 Modified: ${file}` } as LLMMessageContentPartTextBlock)),
				...newFiles.map((
					file,
				) => ({ type: 'text', text: `📄 Created: ${file}` } as LLMMessageContentPartTextBlock)),
			];

			const toolResults = toolResultContentParts;
			const toolResponse = `Applied patch successfully to ${modifiedFiles.length + newFiles.length} file(s)`;
			const bbaiResponse = `BBai has applied patch successfully to ${
				modifiedFiles.length + newFiles.length
			} file(s)`;

			return { toolResults, toolResponse, bbaiResponse };
		} catch (error) {
			let errorMessage: string;
			if (error instanceof Deno.errors.NotFound) {
				errorMessage = `File not found: ${error.message}`;
			} else if (error instanceof Deno.errors.PermissionDenied) {
				errorMessage = `Permission denied: ${error.message}`;
			} else {
				errorMessage = `Failed to apply patch: ${error.message}`;
			}
			logger.error(errorMessage);

			const toolResultContentParts: LLMMessageContentParts = [
				{
					type: 'text',
					text: `⚠️  ${errorMessage}`,
				},
			];

			const bbaiResponse = `BBai failed to apply patch. Error: ${errorMessage}`;
			const toolResponse = `Failed to apply patch. Error: ${errorMessage}`;
			return { toolResults: toolResultContentParts, toolResponse, bbaiResponse };
		}
	}
}
