import { join } from '@std/path';
import { contentType } from '@std/media-types';
import { extname } from '@std/path';

import {
	existsWithinProject,
	FILE_LISTING_TIERS,
	generateFileListing,
	isPathWithinProject,
} from '../utils/fileHandling.utils.ts';
import type LLMConversationInteraction from '../llms/interactions/conversationInteraction.ts';
import type { ProjectInfo as BaseProjectInfo } from '../llms/interactions/conversationInteraction.ts';
import type { FileMetadata } from 'shared/types.ts';
import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';

// Extend ProjectInfo to include startDir
export interface ProjectInfo extends BaseProjectInfo {
	startDir: string;
}
import OrchestratorController from '../controllers/orchestratorController.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManager, type FullConfigSchema } from 'shared/configManager.ts';
import type { ConversationId, ConversationResponse } from 'shared/types.ts';
import type { LLMToolManagerToolSetType } from '../llms/llmToolManager.ts';
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
	//private fileRevisions: Map<string, string[]> = new Map();
	public orchestratorController!: OrchestratorController;
	public fullConfig!: FullConfigSchema;
	public eventManager!: EventManager;
	public startDir: string;
	public projectRoot: string;
	public toolSet: LLMToolManagerToolSetType = 'coding';

	public patchedFiles: Set<string> = new Set();
	public patchContents: Map<string, string> = new Map();
	private _projectInfo: ProjectInfo = {
		startDir: '',
		type: 'empty',
		content: '',
		tier: null,
	};

	constructor(startDir: string) {
		this.projectRoot = '.'; // init() will overwrite this
		this.startDir = startDir;
		this._projectInfo.startDir = startDir;
	}

	public async init(): Promise<ProjectEditor> {
		try {
			this.projectRoot = await this.getProjectRoot();
			this.fullConfig = await ConfigManager.fullConfig(this.projectRoot);
			logger.info(
				`ProjectEditor config for ${this.fullConfig.api.apiHostname}:${this.fullConfig.api.apiPort}`,
			);
			this.eventManager = EventManager.getInstance();
			this.orchestratorController = await new OrchestratorController(this)
				.init();

			logger.info(`ProjectEditor initialized for ${this.startDir}`);
		} catch (error) {
			logger.error(
				`Failed to initialize ProjectEditor in ${this.startDir}:`,
				error,
			);
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

	public async writeToBbaiDir(
		filename: string,
		content: string,
	): Promise<void> {
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
		projectInfo.startDir = this.startDir;
		this._projectInfo = projectInfo;
	}

	public async updateProjectInfo(): Promise<void> {
		const projectInfo: ProjectInfo = {
			startDir: this.startDir,
			type: 'empty',
			content: '',
			tier: null,
		};

		if (projectInfo.type === 'empty') {
			const projectRoot = await this.getProjectRoot();
			const fileListingContent = await generateFileListing(projectRoot);

			if (fileListingContent) {
				projectInfo.type = 'file-listing';
				projectInfo.content = fileListingContent;
				// Determine which tier was used for file listing
				const tier = FILE_LISTING_TIERS.findIndex((
					t: { depth: number; includeMetadata: boolean },
				) => t.depth === Infinity && t.includeMetadata === true);
				projectInfo.tier = tier !== -1 ? tier : null;
			}
		}

		this.projectInfo = { ...projectInfo, startDir: this.startDir };
	}

	public async initConversation(
		conversationId: ConversationId,
	): Promise<LLMConversationInteraction> {
		logger.info(
			`ProjectEditor: Initializing a conversation with ID: ${conversationId}`,
		);
		return await this.orchestratorController.initializePrimaryInteraction(
			conversationId,
		);
	}

	async handleStatement(
		statement: string,
		conversationId: ConversationId,
	): Promise<ConversationResponse> {
		await this.initConversation(conversationId);
		logger.info(
			`ProjectEditor: Initialized conversation with ID: ${conversationId}, handling statement`,
		);
		const statementAnswer = await this.orchestratorController.handleStatement(
			statement,
			conversationId,
		);
		return statementAnswer;
	}

	// prepareFilesForConversation is called by request_files tool and by add_file handler for user requests
	// only existing files can be prepared and added, otherwise call rewrite_file tools with createIfMissing:true
	async prepareFilesForConversation(
		fileNames: string[],
	): Promise<
		Array<
			{
				fileName: string;
				metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>;
			}
		>
	> {
		const filesAdded: Array<
			{
				fileName: string;
				metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>;
			}
		> = [];

		for (const fileName of fileNames) {
			try {
				if (!await isPathWithinProject(this.projectRoot, fileName)) {
					throw new Error(`Access denied: ${fileName} is outside the project directory`);
				}
				if (!await existsWithinProject(this.projectRoot, fileName)) {
					throw new Error(`Access denied: ${fileName} does not exist in the project directory`);
				}

				const fullFilePath = join(this.projectRoot, fileName);

				const fileExtension = extname(fileName);
				const mimeType = contentType(fileExtension) || 'application/octet-stream';
				const isImage = mimeType.startsWith('image/');
				const { size } = await Deno.stat(fullFilePath).catch((_) => ({ size: 0 }));

				const metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> = {
					type: isImage ? 'image' : 'text',
					mimeType: mimeType as LLMMessageContentPartImageBlockSourceMediaType,
					lastModified: new Date(),
					size,
					error: null,
				};
				filesAdded.push({ fileName, metadata });

				logger.info(`ProjectEditor: Prepared file ${fileName}`);
			} catch (error) {
				logger.error(`ProjectEditor: Error adding file ${fileName}: ${error.message}`);
				const errorMessage = error.message;
				filesAdded.push({
					fileName,
					metadata: {
						type: 'text',
						lastModified: new Date(),
						size: 0,
						error: errorMessage,
					},
				});
			}
		}

		return filesAdded;
	}
}

export default ProjectEditor;
