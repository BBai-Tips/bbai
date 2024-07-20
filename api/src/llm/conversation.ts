import {
    LLMMessageContentParts,
    LLMProviderMessageRequest,
    LLMProviderMessageResponse,
    LLMSpeakWithOptions,
    LLMTokenUsage,
} from '../types.ts';
import type { RepoRecId } from '../types.ts';
import LLMMessage from './message.ts';
import type { LLMMessageProviderResponse } from './message.ts';
import LLMTool from './tool.ts';
import LLM from './providers/base.provider.ts';
import LLMProviderMessageResponseRepository from '../repositories/llm_provider_message_response.repository.ts';
import LLMProviderMessageRequestRepository from '../repositories/llm_provider_message_request.repository.ts';
import LLMConversationRepository from '../repositories/llm_conversation.repository.ts';
import { logger } from '../utils/logger.ts';

import { ulid } from '@std/ulid';

class LLMConversation {
    public id: string;
    private llm: LLM;
    private _repoRecId: RepoRecId = '';
    private _turnCount: number = 0;
    private messages: LLMMessage[] = [];
    private tools: LLMTool[] = [];

    private llmConversationRepository: LLMConversationRepository;
    public llmProviderMessageRequestRepository: LLMProviderMessageRequestRepository;
    public llmProviderMessageResponseRepository: LLMProviderMessageResponseRepository;

    protected _system: string = '';
    protected _model: string = '';
    protected _maxTokens: number = 4000;
    protected _temperature: number = 0.2;
    private _totalTokenUsage: LLMTokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
    private _totalProviderRequests: number = 0;
    private _currentPrompt: string = '';

    constructor(llm: LLM) {
        this.id = ulid();
        this.llm = llm;

        this.llmConversationRepository = new LLMConversationRepository();
        this.llmProviderMessageRequestRepository = new LLMProviderMessageRequestRepository();
        this.llmProviderMessageResponseRepository = new LLMProviderMessageResponseRepository();
    }

    private async createLLMConversationDoc(): Promise<void> {
        this._repoRecId = await this.llmConversationRepository.createLLMConversation({
            providerName: this.llm.providerName,
            turnCount: this._turnCount,
            messages: this.messages,
            tools: this.tools,
            tokenUsage: this.totalTokenUsage,
            system: this._system,
            model: this._model,
            maxTokens: this._maxTokens,
            temperature: this._temperature,
            createdAt: new Date(),
        });
    }

    private async updateLLMConversatioDoc(): Promise<void> {
        if (this._repoRecId === '') {
            await this.createLLMConversationDoc();
        }
        try {
            await this.llmConversationRepository.updateLLMConversation(this._repoRecId, {
                providerName: this.llm.providerName,
                turnCount: this._turnCount,
                messages: this.messages,
                tools: this.tools,
                tokenUsage: this.totalTokenUsage,
                system: this._system,
                model: this._model,
                maxTokens: this._maxTokens,
                temperature: this._temperature,
                updatedAt: new Date(),
            });
        } catch (error) {
            logger.error('Error updating LLM conversation document:', error);
        }
    }

    // Getters and setters
    get repoRecId(): RepoRecId {
        return this._repoRecId;
    }

    set repoRecId(value: RepoRecId) {
        this._repoRecId = value;
    }

    get providerName(): string {
        return this.llm.providerName;
    }

    get currentPrompt(): string {
        return this._currentPrompt;
    }

    set currentPrompt(value: string) {
        this._currentPrompt = value;
    }

    get system(): string {
        return this._system;
    }

    set system(value: string) {
        this._system = value;
    }

    get model(): string {
        return this._model;
    }

    set model(value: string) {
        this._model = value;
    }

    get maxTokens(): number {
        return this._maxTokens;
    }

    set maxTokens(value: number) {
        this._maxTokens = value;
    }

    get temperature(): number {
        return this._temperature;
    }

    set temperature(value: number) {
        this._temperature = value;
    }

    get turnCount(): number {
        return this._turnCount;
    }

    get totalTokenUsage(): LLMTokenUsage {
        return this._totalTokenUsage;
    }

    get totalProviderRequests(): number {
        return this._totalProviderRequests;
    }

    updateTotals(tokenUsage: LLMTokenUsage, providerRequests: number): void {
        this._totalTokenUsage.totalTokens += tokenUsage.totalTokens;
        this._totalTokenUsage.inputTokens += tokenUsage.inputTokens;
        this._totalTokenUsage.outputTokens += tokenUsage.outputTokens;
        this._totalProviderRequests += providerRequests;
    }

    addMessage(message: LLMMessage): void {
        this.messages.push(message);
    }

    getMessages(): LLMMessage[] {
        return this.messages;
    }

    getLastMessage(): LLMMessage {
        return this.messages.slice(-1)[0];
    }

    getLastMessageProviderResponse(): LLMMessageProviderResponse | undefined {
        const lastMessage = this.getLastMessage();
        return lastMessage?.providerResponse;
    }

    getLastMessageContent(): LLMMessageContentParts | undefined {
        const lastMessage = this.getLastMessage();
        return lastMessage?.content;
    }

    clearMessages(): void {
        this.messages = [];
    }

    addTool(tool: LLMTool): void {
        this.tools.push(tool);
    }

    addTools(tools: LLMTool[]): void {
        tools.forEach((tool: LLMTool) => {
            this.tools.push(tool);
        });
    }

    getTools(): LLMTool[] {
        return this.tools;
    }

    clearTools(): void {
        this.tools = [];
    }

    async speakWithLLM(
        prompt: string,
        speakOptions?: LLMSpeakWithOptions,
    ): Promise<LLMProviderMessageResponse> {
        if (!speakOptions) {
            speakOptions = {} as LLMSpeakWithOptions;
        }

        if (this._repoRecId === '') {
            await this.createLLMConversationDoc();
        }

        this._turnCount++;
        this.addMessage(
            { role: 'user', content: [{ type: 'text', text: prompt }] as LLMMessageContentParts } as LLMMessage,
        );

        const llmProviderMessageResponse = await this.llm.speakWithRetry(this, speakOptions);

        this.updateLLMConversatioDoc();

        return llmProviderMessageResponse;
    }
}

export default LLMConversation;
