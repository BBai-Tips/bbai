export interface VectorEmbedding {
	id: string;
	vector: number[];
	metadata: Record<string, unknown>;
}
