import { readFile } from "node:fs/promises";
import path from "node:path";

export type DadaSource = {
  title: string;
  authority: string;
  url: string;
  status?: string;
  excerpt: string;
};

type IndexedDocument = DadaSource & { embedding: number[] };
type RagIndex = { documents: IndexedDocument[] };

const INDEX_PATH = path.join(process.cwd(), "data", "dada-rag.json");
const VECTOR_DIMENSIONS = 256;
let cachedIndex: RagIndex | undefined;

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

async function getIndex() {
  if (cachedIndex) return cachedIndex;
  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    cachedIndex = JSON.parse(raw) as RagIndex;
  } catch {
    cachedIndex = { documents: [] };
  }
  return cachedIndex;
}

export async function embed(text: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter is not configured");
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "qwen/qwen3-embedding-8b", input: text }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`OpenRouter embedding failed (${response.status})`);
  const body = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const vector = body.data?.[0]?.embedding;
  if (!vector?.length) throw new Error("OpenRouter returned an empty embedding");
  // Qwen3 Embedding utilise le Matryoshka Representation Learning : le préfixe du
  // vecteur reste exploitable pour la recherche, tout en gardant l’index local compact.
  return vector.slice(0, VECTOR_DIMENSIONS);
}

/** Returns null only when no local RAG corpus has been indexed yet. */
export async function searchRag(question: string, limit = 6): Promise<DadaSource[] | null> {
  const index = await getIndex();
  if (!index.documents.length) return null;
  const queryEmbedding = await embed(question);
  return index.documents
    .map((document) => ({ document, score: cosineSimilarity(queryEmbedding, document.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ document }) => ({
      title: document.title,
      authority: document.authority,
      url: document.url,
      status: document.status,
      excerpt: document.excerpt
    }));
}
