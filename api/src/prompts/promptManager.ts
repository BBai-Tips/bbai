import { join } from "std/path/mod.ts";
import { exists } from "std/fs/mod.ts";
import { parse as parseYaml } from "std/yaml/mod.ts";
import { stripIndent } from "common-tags";

interface PromptMetadata {
  name: string;
  description: string;
  version: string;
}

interface Prompt {
  metadata: PromptMetadata;
  content: string;
}

export class PromptManager {
  private defaultPromptsDir: string;
  private userPromptsDir: string;

  constructor(projectRoot: string) {
    this.defaultPromptsDir = join(Deno.cwd(), "api", "prompts");
    this.userPromptsDir = join(projectRoot, ".bbai", "prompts");
  }

  async getPrompt(promptName: string): Promise<string> {
    const userPrompt = await this.loadPrompt(this.userPromptsDir, promptName);
    if (userPrompt) {
      return userPrompt.content;
    }

    const defaultPrompt = await this.loadPrompt(this.defaultPromptsDir, promptName);
    if (defaultPrompt) {
      return defaultPrompt.content;
    }

    throw new Error(`Prompt '${promptName}' not found`);
  }

  private async loadPrompt(directory: string, promptName: string): Promise<Prompt | null> {
    const promptPath = join(directory, `${promptName}.md`);
    if (!(await exists(promptPath))) {
      return null;
    }

    const content = await Deno.readTextFile(promptPath);
    const [metadataStr, promptContent] = content.split("---\n").slice(1);

    const metadata = parseYaml(metadataStr) as PromptMetadata;
    return {
      metadata,
      content: stripIndent(promptContent.trim()),
    };
  }

  applyTemplate(template: string, variables: Record<string, string>): string {
    return stripIndent(template).replace(
      /\${(\w+)}/g,
      (_, key) => variables[key] || `\${${key}}`
    );
  }

  // Basic validation for user-supplied prompts
  validatePrompt(prompt: Prompt): boolean {
    if (!prompt.metadata || !prompt.content) {
      return false;
    }
    if (!prompt.metadata.name || !prompt.metadata.description || !prompt.metadata.version) {
      return false;
    }
    return true;
  }
}
