import { LLMTool } from '../llmTool.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { ensureFileSync, writeTextFileSync } from 'std/fs/mod.ts';

export class RewriteFileTool extends LLMTool {
  name = 'rewrite_file';
  description = 'Rewrite an entire file or create a new one';

  async execute(params: { filePath: string; content: string; createIfMissing?: boolean }): Promise<string> {
    const { filePath, content, createIfMissing = true } = params;

    if (!isPathWithinProject(filePath)) {
      throw new Error('File path is not within the project directory');
    }

    try {
      if (createIfMissing) {
        ensureFileSync(filePath);
      }
      writeTextFileSync(filePath, content);
      return `File ${filePath} has been successfully rewritten or created.`;
    } catch (error) {
      throw new Error(`Failed to rewrite or create file: ${error.message}`);
    }
  }

  getParameterSchema() {
    return {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The path of the file to be rewritten or created' },
        content: { type: 'string', description: 'The new content of the file' },
        createIfMissing: { type: 'boolean', description: 'Create the file if it does not exist', default: true }
      },
      required: ['filePath', 'content']
    };
  }
}
