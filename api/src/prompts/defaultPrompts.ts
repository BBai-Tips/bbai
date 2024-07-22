import { stripIndents } from 'common-tags';

import { loadConfig, readFileContent, resolveFilePath } from 'shared/dataDir.ts';

interface PromptMetadata {
	name: string;
	description: string;
	version: string;
}

interface Prompt {
	metadata: PromptMetadata;
	getContent: (variables: Record<string, any>) => Promise<string>;
}

export const system: Prompt = {
	metadata: {
		name: 'System Prompt',
		description: 'Default system prompt for bbai',
		version: '1.0.0',
	},
	getContent: async ({ userDefinedContent = '' }) => {
		const config = await loadConfig();
		const guidelinesPath = config.llmGuidelinesFile;
		let guidelines = '';

		if (guidelinesPath) {
			try {
				const resolvedPath = await resolveFilePath(guidelinesPath);
				guidelines = await readFileContent(resolvedPath) || '';
			} catch (error) {
				console.error(`Failed to load guidelines: ${error.message}`);
			}
		}

		const config = await loadConfig();
		const personsName = config.personsName || Deno.env.get('USER') || 'User';

		return stripIndents`
		  You are an AI assistant, an expert at a variety of coding tasks. Your capabilities include:
	
		  1. Analyzing and modifying programming code in any language
		  2. Reviewing and enhancing documentation and prose
		  3. Assisting with fiction writing
		  4. Crafting and refining LLM prompts
		  5. Working with HTML, SVG, and various markup languages
		  6. Handling configuration files and data formats (JSON, YAML, etc.)
	
		  You are facilitating a conversation between bbai (a personal writing assistant) and ${personsName}. All conversation messages will be labeled as either 'assistant' or 'user'. The 'user' messages will contain instructions for both bbai and ${personsName}. You should respect instructions from both bbai and ${personsName}, but always prioritize instructions or comments from ${personsName}.
	
		  You have access to a local repository and can work with files that have been added to the conversation. When responding to tool use requests for adding files, you should only use the ctags information provided as a source for looking up file names.
	
		  Always strive to provide helpful, accurate, and context-aware assistance.
	
		  ${userDefinedContent ? `\n${userDefinedContent}\n` : ''}
		  ${guidelines ? `Guidelines:\n${guidelines}` : ''}
		`;
	},
};

export const addFiles: Prompt = {
	metadata: {
		name: 'Add Files Prompt',
		description: 'Prompt for adding files to the conversation',
		version: '1.0.0',
	},
	getContent: async ({ fileList }) =>
		stripIndents`
    The following files have been added to the conversation:

    ${fileList.map((file: string) => `- ${file}`).join('\n')}

    Please review these files and provide any relevant insights or suggestions based on their content.
  `,
};

// Add other default prompts here as needed
