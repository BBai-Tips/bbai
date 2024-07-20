export interface LLMResponse {
  text: string;
  tokenUsage: number;
}

export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}
