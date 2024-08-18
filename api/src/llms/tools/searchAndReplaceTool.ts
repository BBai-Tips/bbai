import LLMTool, {
	LLMToolFormatterDestination,
	LLMToolInputSchema,
	LLMToolRunResult,
	LLMToolRunResultContent,
} from 'api/llms/llmTool.ts';
import { colors } from 'cliffy/ansi/mod.ts';
import { html, safeHtml, stripIndent, stripIndents } from 'common-tags';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../../errors/error.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { logger } from 'shared/logger.ts';
import { dirname, join } from '@std/path';
import { ensureDir } from '@std/fs';
import { getContentFromToolResult } from '../../utils/llms.utils.ts';

export class LLMToolSearchAndReplace extends LLMTool {
	private static readonly MIN_SEARCH_LENGTH = 1;

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
									'The exact literal text to search for, with all leading and trailing whitespace from the original file; prepare the search text with JSON encoding, such as escaping backslash characters',
							},
							replace: {
								type: 'string',
								description:
									'The text to replace with, matching the same indent level as the original file',
							},
							replaceAll: {
								type: 'boolean',
								description: 'Whether to replace all occurrences or just the first one',
								default: false,
							},
							caseSensitive: {
								type: 'boolean',
								description: 'Whether the search should be case-sensitive',
								default: true,
							},
						},
						required: ['search', 'replace'],
					},
					description: 'List of literal search and replace operations to apply',
				},
				createIfMissing: {
					type: 'boolean',
					description: 'Create the file if it does not exist (recommended to set this to true)',
					default: true,
				},
			},
			required: ['filePath', 'operations'],
		};
	}

	toolUseInputFormatter(toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination = 'console'): string {
		const { filePath, operations, createIfMissing = true } = toolInput;

		let formattedInput = '';

		if (format === 'console') {
			formattedInput = stripIndents`
				File: ${colors.bold(filePath)} (${
				colors.bold(createIfMissing ? 'Create if missing' : "Don't create new file")
			})
				
				${colors.bold('Operations:\n')}
			`;
			operations.forEach(
				(
					op: { search: string; replace: string; replaceAll: boolean; caseSensitive: boolean },
					index: number,
				) => {
					formattedInput += `
${colors.bold(`Operation ${index + 1}:`)} (${colors.bold(op.replaceAll ? 'Replace all' : 'Replace first')})  (${
						colors.bold(op.caseSensitive ? 'Case sensitive' : 'Case insensitive')
					})
${colors.yellow.bold('Search:')}
${op.search}

${colors.green.bold('Replace:')}
${op.replace}

`;
				},
			);
		} else if (format === 'browser') {
			formattedInput = stripIndents`
					<p><strong>File:</strong> ${filePath}  <strong>(${
				createIfMissing ? 'Create if missing' : "Don't create new file"
			})</strong></p>
					<h3>Operations:</h3>
				`;
			operations.forEach(
				(
					op: { search: string; replace: string; replaceAll: boolean; caseSensitive: boolean },
					index: number,
				) => {
					formattedInput += safeHtml`
						<div>
						<h4>Operation ${index + 1}: <strong>(${
						op.replaceAll ? 'Replace all' : 'Replace first'
					})</strong> <strong>(${op.caseSensitive ? 'Case sensitive' : 'Case insensitive'})</strong></h4>
						<p><strong>Search:</strong></p>
						<pre style="color: #DAA520;">${op.search}</pre>
						<p><strong>Replace:</strong></p>
						<pre style="color: #228B22;">${op.replace}</pre>
						<p><strong>Replace all:</strong> ${op.replaceAll ?? false}</p>
						<p><strong>Case sensitive:</strong> ${op.caseSensitive ?? true}</p>
						</div>
					`;
				},
			);
		}

		return formattedInput;
	}

	toolRunResultFormatter(
		toolResult: LLMToolRunResultContent,
		format: LLMToolFormatterDestination = 'console',
	): string {
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
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		let allOperationsFailed = true;
		let allOperationsSucceeded = true;
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { filePath, operations, createIfMissing = true } = toolInput as {
			filePath: string;
			operations: Array<{ search: string; replace: string; replaceAll?: boolean; caseSensitive?: boolean }>;
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
			let isNewFile = false;
			try {
				content = await Deno.readTextFile(fullFilePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					content = '';
					isNewFile = true;
					logger.info(`File ${fullFilePath} not found. Creating new file.`);
					// Create missing directories
					await ensureDir(dirname(fullFilePath));
					logger.info(`Created directory structure for ${fullFilePath}`);
				} else {
					throw error;
				}
			}

			const operationResults = [];
			let successfulOperations = [];
			for (const [index, operation] of operations.entries()) {
				const { search, replace, replaceAll = false, caseSensitive = true } = operation;
				let operationWarnings = [];
				let operationSuccess = false;

				// Validate search string
				if (!isNewFile && search.length < LLMToolSearchAndReplace.MIN_SEARCH_LENGTH) {
					operationWarnings.push(
						`Search string is too short (minimum ${LLMToolSearchAndReplace.MIN_SEARCH_LENGTH} character(s)) for existing file.`,
					);
					continue;
				}

				// Validate that search and replace strings are different
				if (search === replace) {
					operationWarnings.push('Search and replace strings are identical.');
					continue;
				}

				const originalContent = content;
				if (replaceAll) {
					content = caseSensitive
						? content.replaceAll(search, replace)
						: content.replaceAll(new RegExp(search, 'gi'), replace);
				} else {
					content = caseSensitive
						? content.replace(search, replace)
						: content.replace(new RegExp(search, 'i'), replace);
				}

				// Check if the content actually changed
				if (content !== originalContent) {
					operationSuccess = true;
					allOperationsFailed = false;
					successfulOperations.push(operation);
				} else {
					operationWarnings.push(
						'No changes were made. The search string was not found in the file content.',
					);
					allOperationsSucceeded = false;
				}

				if (operationWarnings.length > 0) {
					operationResults.push({
						operationIndex: index,
						status: 'warning',
						message: `Operation ${index + 1} warnings: ${operationWarnings.join(' ')}`,
					});
					allOperationsSucceeded = false;
				} else if (operationSuccess) {
					operationResults.push({
						operationIndex: index,
						status: 'success',
						message: `Operation ${index + 1} completed successfully`,
					});
				} else {
					operationResults.push({
						operationIndex: index,
						status: 'warning',
						message: `Operation ${index + 1} failed: No changes were made`,
					});
					allOperationsSucceeded = false;
				}
			}

			if (successfulOperations.length > 0 || isNewFile) {
				await Deno.writeTextFile(fullFilePath, content);

				logger.info(`Saving conversation search and replace operations: ${interaction.id}`);
				await projectEditor.orchestratorController.logPatchAndCommit(
					interaction,
					filePath,
					JSON.stringify(successfulOperations),
				);

				const toolResultContentParts: LLMMessageContentParts = operationResults.map((result: any) => ({
					type: 'text',
					text: `${result.status === 'success' ? '✅  ' : '⚠️  '} Operation ${
						result.operationIndex + 1
					}: ${result.message}`,
				}));

				const operationStatus = allOperationsSucceeded
					? 'All operations succeeded'
					: (allOperationsFailed ? 'All operations failed' : 'Partial operations succeeded');
				toolResultContentParts.unshift({
					type: 'text',
					text: `${
						isNewFile ? 'File created and s' : 'S'
					}earch and replace operations applied to file: ${filePath}. ${operationStatus}.`,
				});

				const toolResults = toolResultContentParts;
				const toolResponse = operationStatus;
				const bbaiResponse = `BBai applied search and replace operations.\n${
					getContentFromToolResult(toolResultContentParts)
				}`;

				return { toolResults, toolResponse, bbaiResponse };
			} else {
				const noChangesMessage = `No changes were made to the file: ${filePath}. Results: ${
					JSON.stringify(operationResults)
				}`;
				logger.info(noChangesMessage);

				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'search-and-replace',
					filePath: filePath,
					operation: 'search-replace',
				} as FileHandlingErrorOptions);

				//const toolResultContentParts: LLMMessageContentParts = [{
				//	type: 'text',
				//	text: noChangesMessage,
				//}];
				//return { toolResults: toolResultContentParts, toolResponse: noChangesMessage, bbaiResponse: noChangesMessage };
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
