import { join } from "@std/path";
import { exists } from "@std/fs";
import { parse as parseYaml } from "yaml";
import { stripIndents } from "common-tags";
import { getBbaiDir } from "shared/dataDir.ts";
import * as defaultPrompts from "./defaultPrompts.ts";

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
  private userPromptsDir: string;

  constructor() {
    this.userPromptsDir = "";
    this.initializeUserPromptsDir();
  }

  private async initializeUserPromptsDir() {
    const bbaiDir = await getBbaiDir();
    this.userPromptsDir = join(bbaiDir, "prompts");
  }

  async getPrompt(promptName: string): Promise<string> {
    const userPrompt = await this.loadUserPrompt(promptName);
    const defaultPrompt = defaultPrompts[promptName as keyof typeof defaultPrompts];

    if (!userPrompt && !defaultPrompt) {
      throw new Error(`Prompt '${promptName}' not found`);
    }

    const promptContent = userPrompt?.content || defaultPrompt?.content || '';
    const userDefinedContent = ''; // This would be populated from somewhere else in your application

    // Use template literal for interpolation
    return `${promptContent}\n\n${userDefinedContent}`.trim();
  }

  private async loadUserPrompt(promptName: string): Promise<Prompt | null> {
    const promptPath = join(this.userPromptsDir, `${promptName}.md`);
    if (!(await exists(promptPath))) {
      return null;
    }

    const content = await Deno.readTextFile(promptPath);
    const [metadataStr, promptContent] = content.split("---\n").slice(1);

    const metadata = parseYaml(metadataStr) as PromptMetadata;
    return {
      metadata,
      content: stripIndents(promptContent.trim()),
    };
  }

  applyTemplate(template: string, variables: Record<string, any>): string {
    return stripIndents(template).replace(
      /\${(.*?)}/g,
      (_, expr) => {
        try {
          // Create a function that takes variables as arguments and evaluates the expression
          const func = new Function(...Object.keys(variables), `return ${expr};`);
          return func(...Object.values(variables));
        } catch (error) {
          console.error(`Error evaluating expression: ${expr}`, error);
          return `\${${expr}}`;
        }
      }
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
