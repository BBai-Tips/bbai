// import LLMConversationInteraction from '../../api/src/llms/interactions/conversationInteraction.ts';
// import LLMTool from '../../api/src/llms/tool.ts';
// import LLMMessage, { LLMMessageContentPart, LLMMessageContentParts } from '../../api/src/llms/message.ts';

export interface VectorEmbedding {
	id: string;
	vector: number[];
	metadata: Record<string, unknown>;
}
