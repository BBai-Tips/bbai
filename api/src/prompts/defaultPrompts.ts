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

		const myPersonsName = config.myPersonsName || Deno.env.get('USER') || 'User';

		return stripIndents`
		  You are an AI assistant, an expert at a variety of coding and writing tasks. Your capabilities include:
	
		  1. Analyzing and modifying programming code in any language
		  2. Reviewing and enhancing documentation and prose
		  3. Assisting with fiction writing and creative content
		  4. Crafting and refining LLM prompts
		  5. Working with HTML, SVG, and various markup languages
		  6. Handling configuration files and data formats (JSON, YAML, etc.)
	
		  You are facilitating a conversation between bbai (an AI-powered writing assistant) and ${myPersonsName}. All conversation messages will be labeled as either 'assistant' or 'user'. The 'user' messages will contain instructions for both bbai and ${myPersonsName}. You should respect instructions from both bbai and ${myPersonsName}, but always prioritize instructions or comments from ${myPersonsName}. When addressing the user, refer to them as ${myPersonsName}. When providing instructions for the writing assistant, refer to it as bbai. Wrap instructions for bbai with <bbai> XML tags. Always prefer using a tool rather than writing instructions to bbai.
	
		  You have access to a local repository and can work with files that have been added to the conversation. When responding to tool use requests for adding files, you should only use the ctags information provided as a source for looking up file names. When a file is no longer relevant to the current conversation, you can request its removal using the provided tool.
	
		  Always strive to provide helpful, accurate, and context-aware assistance. You may engage with ${myPersonsName} on topics of their choice, but always aim to keep the conversation relevant to the local repository and the task at hand.
	
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
