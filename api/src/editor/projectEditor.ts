import { join } from '@std/path';

import { FILE_LISTING_TIERS, generateFileListing, isPathWithinProject } from '../utils/fileHandling.utils.ts';
import LLMConversationInteraction, { FileMetadata, ProjectInfo } from '../llms/interactions/conversationInteraction.ts';
import OrchestratorController from '../controllers/orchestratorController.ts';
import { logger } from 'shared/logger.ts';
//import { config } from 'shared/configManager.ts';
//import {LLMSpeakWithResponse} from 'api/types.ts';
//import  { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { ConversationId, ConversationResponse } from 'shared/types.ts';
import { LLMToolManagerToolSetType } from '../llms/llmToolManager.ts';
import {
	getBbaiDataDir,
	getBbaiDir,
	getProjectRoot,
	readFromBbaiDir,
	removeFromBbaiDir,
	writeToBbaiDir,
} from 'shared/dataDir.ts';
import EventManager from 'shared/eventManager.ts';

class ProjectEditor {
	public orchestratorController!: OrchestratorController;
	public eventManager!: EventManager;
	public startDir: string;
	public projectRoot: string;
	public toolSet: LLMToolManagerToolSetType = 'coding';

	public patchedFiles: Set<string> = new Set();
	public patchContents: Map<string, string> = new Map();
	private _projectInfo: ProjectInfo = {
		type: 'empty',
		content: '',
		tier: null,
	};

	constructor(startDir: string) {
		this.projectRoot = '.'; // init() will overwrite this
		this.startDir = startDir;
	}

	public async init(): Promise<ProjectEditor> {
		try {
			this.projectRoot = await this.getProjectRoot();
			this.eventManager = EventManager.getInstance();
			this.orchestratorController = await new OrchestratorController(this).init();
		} catch (error) {
			logger.error(`Failed to initialize ProjectEditor in ${this.startDir}:`, error);
			throw error;
		}
		return this;
	}

	public async getProjectRoot(): Promise<string> {
		return await getProjectRoot(this.startDir);
	}

	public async getBbaiDir(): Promise<string> {
		return await getBbaiDir(this.startDir);
	}

	public async getBbaiDataDir(): Promise<string> {
		return await getBbaiDataDir(this.startDir);
	}

	public async writeToBbaiDir(filename: string, content: string): Promise<void> {
		return await writeToBbaiDir(this.startDir, filename, content);
	}

	public async readFromBbaiDir(filename: string): Promise<string | null> {
		return await readFromBbaiDir(this.startDir, filename);
	}

	public async removeFromBbaiDir(filename: string): Promise<void> {
		return await removeFromBbaiDir(this.startDir, filename);
	}

	get projectInfo(): ProjectInfo {
		return this._projectInfo;
	}

	set projectInfo(projectInfo: ProjectInfo) {
		this._projectInfo = projectInfo;
	}

	public async updateProjectInfo(): Promise<void> {
		const projectInfo: ProjectInfo = { type: 'empty', content: '', tier: null };

		/*
		await generateCtags(this.bbaiDir, this.projectRoot);
		const ctagsContent = await readCtagsFile(this.bbaiDir);
		if (ctagsContent) {
			projectInfo.type = 'ctags';
			projectInfo.content = ctagsContent;
			projectInfo.tier = 0; // Assuming ctags is always tier 0
		}
		 */

		if (projectInfo.type === 'empty') {
			const projectRoot = await this.getProjectRoot();
			const fileListingContent = await generateFileListing(projectRoot);

			if (fileListingContent) {
				projectInfo.type = 'file-listing';
				projectInfo.content = fileListingContent;
				// Determine which tier was used for file listing
				const tier = FILE_LISTING_TIERS.findIndex((t: { depth: number; includeMetadata: boolean }) =>
					t.depth === Infinity && t.includeMetadata === true
				);
				projectInfo.tier = tier !== -1 ? tier : null;
			}
		}

		this.projectInfo = projectInfo;
	}

	public async initConversation(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		logger.info(`Initializing a conversation with ID: ${conversationId}`);
		return await this.orchestratorController.initializePrimaryInteraction(conversationId);
	}

	async handleStatement(statement: string, conversationId: ConversationId): Promise<ConversationResponse> {
		await this.initConversation(conversationId);
		const statementAnswer = await this.orchestratorController.handleStatement(statement, conversationId);
		return statementAnswer;
	}

	/*
	private determineStorageLocation(_filePath: string, content: string, source: 'tool' | 'user'): 'system' | 'message' {
		if (source === 'tool') {
			return 'message';
		}
		const fileSize = new TextEncoder().encode(content).length;
		const fileCount = this.conversation?.listFiles().length || 0;

		if (fileCount < 10 && fileSize < 50 * 1024) {
			return 'system';
		} else {
			return 'message';
		}
	}
	 */

	// prepareFilesForConversation is called by request_files tool and by add_file handler for user requests
	async prepareFilesForConversation(
		fileNames: string[],
	): Promise<Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }>> {
		const filesAdded: Array<{ fileName: string; metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> }> = [];

		for (const fileName of fileNames) {
			try {
				if (!await isPathWithinProject(this.projectRoot, fileName)) {
					throw new Error(`Access denied: ${fileName} is outside the project directory`);
				}

				const fullFilePath = join(this.projectRoot, fileName);
				const content = await Deno.readTextFile(fullFilePath);
				// [TODO] getting the last commit fails in tests - need to mock/stub static method `GitUtils.getLastCommitForFile` (not sure how??)
				//const lastCommit = await GitUtils.getLastCommitForFile(this.projectRoot, fileName) || '';
				const metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> = {
					size: new TextEncoder().encode(content).length,
					lastModified: new Date(),
					error: null,
					//lastCommit: lastCommit,
				};
				filesAdded.push({ fileName, metadata });

				logger.info(`ProjectEditor has prepared file ${fileName}`);
			} catch (error) {
				logger.error(`Error adding file ${fileName}: ${error.message}`);
				// [TODO] Sanitize the error message so it doesn't send (eg) fill file path
				//const errorMessage = error.message.includes('No such file or directory') ? 'File Not Found' : '';
				const errorMessage = error.message;
				filesAdded.push({
					fileName,
					metadata: {
						size: 0,
						lastModified: new Date(),
						error: errorMessage,
						//lastCommit: '',
					},
				});
			}
		}

		return filesAdded;
	}
}

export default ProjectEditor;
