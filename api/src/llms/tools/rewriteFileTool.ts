import LLMTool from '../llmTool.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { ensureFile, writeTextFile } from 'https://deno.land/std/fs/mod.ts';

export class RewriteFileTool implements LLMTool {
  name = 'rewrite_file';
  description = 'Rewrite an entire file or create a new one';

  async execute(params: { filePath: string; content: string; createIfMissing?: boolean }): Promise<string> {
    return this.runTool(params);
    const { filePath, content, createIfMissing = true } = params;

    if (!await isPathWithinProject(Deno.cwd(), filePath)) {
      throw new Error('File path is not within the project directory');
    }

    try {
      if (createIfMissing) {
        await ensureFile(filePath);
      }
      await writeTextFile(filePath, content);
      return `File ${filePath} has been successfully rewritten or created.`;
    } catch (error) {
      throw new Error(`Failed to rewrite or create file: ${error.message}`);
    }
  }

  input_schema = {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'The path of the file to be rewritten or created' },
      content: { type: 'string', description: 'The new content of the file' },
      createIfMissing: { type: 'boolean', description: 'Create the file if it does not exist', default: true }
    },
    required: ['filePath', 'content']
  };

  validateInput(input: unknown): boolean {
    // Implement input validation logic here
    return true;
  }

  async runTool(params: { filePath: string; content: string; createIfMissing?: boolean }): Promise<string> {
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
