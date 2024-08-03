import LLMTool, { LLMToolInputSchema } from '../llmTool.ts';
import { LLMAnswerToolUse } from '../llmMessage.ts';
import { ProjectEditor } from '../../editor/projectEditor.ts';
import { searchFiles } from '../../utils/fileHandling.utils.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';

export class LLMToolSearchProject extends LLMTool {
	constructor() {
		super(
			'search_project',
			'Search the project for files matching a pattern',
		);
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				pattern: {
					type: 'string',
					description: 'The search pattern to use (grep-compatible regular expression)',
				},
				file_pattern: {
					type: 'string',
					description: 'Optional file pattern to limit the search to specific file types',
				},
			},
			required: ['pattern'],
		};
	}

	async runTool(
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<{ messageId: string; feedback: string }> {
		const { toolInput } = toolUse;
		const { pattern, file_pattern } = toolInput as { pattern: string; file_pattern?: string };

		try {
			const { files, errorMessage } = await searchFiles(projectEditor.projectRoot, pattern, file_pattern);

			const resultMessage = `BBai has found ${files.length} files matching the pattern "${pattern}"${
				file_pattern ? ` with file pattern "${file_pattern}"` : ''
			}:\n<files>\n${files.join('\n')}\n</files>`;

			const { messageId, feedback } = projectEditor.toolManager.finalizeToolUse(
				toolUse,
				resultMessage,
				!!errorMessage,
				projectEditor,
			);

			return { messageId, feedback: `${feedback}\n${resultMessage}` };
		} catch (error) {
			logger.error(`Error searching project: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error searching project: ${error.message}`, {
				name: 'search-project',
				filePath: projectEditor.projectRoot,
				operation: 'search-project',
			});
		}
	}
}
