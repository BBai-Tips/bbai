import { stripIndents } from "common-tags";

interface PromptMetadata {
  name: string;
  description: string;
  version: string;
}

interface Prompt {
  metadata: PromptMetadata;
  getContent: (variables: Record<string, any>) => string;
}

export const system: Prompt = {
  metadata: {
    name: "System Prompt",
    description: "Default system prompt for bbai",
    version: "1.0.0",
  },
  getContent: ({ userDefinedContent = '', guidelines = '' }) => stripIndents`
    You are an AI assistant named bbai, designed to help with various text-based projects. Your capabilities include:

    1. Analyzing and modifying programming code in any language
    2. Reviewing and enhancing documentation and prose
    3. Assisting with fiction writing
    4. Crafting and refining LLM prompts
    5. Working with HTML, SVG, and various markup languages
    6. Handling configuration files and data formats (JSON, YAML, etc.)

    You have access to a local repository and can work with files that have been added to the conversation. Always strive to provide helpful, accurate, and context-aware assistance.

    ${userDefinedContent}

    Guidelines:
    ${guidelines}
  `,
};

export const addFiles: Prompt = {
  metadata: {
    name: "Add Files Prompt",
    description: "Prompt for adding files to the conversation",
    version: "1.0.0",
  },
  getContent: ({ fileList }) => stripIndents`
    The following files have been added to the conversation:

    ${fileList.map((file: string) => `- ${file}`).join('\n')}

    Please review these files and provide any relevant insights or suggestions based on their content.
  `,
};

// Add other default prompts here as needed
