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
    if (userPrompt) {
      return userPrompt.content;
    }

    const defaultPrompt = defaultPrompts[promptName as keyof typeof defaultPrompts];
    if (defaultPrompt) {
      return defaultPrompt.content;
    }

    throw new Error(`Prompt '${promptName}' not found`);
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

  applyTemplate(template: string, variables: Record<string, string>): string {
    return stripIndents(template).replace(
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
