/**
 * Simple text embedding utility using hash-based vectorization.
 * In production, you'd use a real embedding model (OpenAI, etc.).
 * This provides a deterministic vector representation for cosine similarity.
 */

const VECTOR_DIM = 128;

/**
 * Generate a deterministic hash for a string
 */
function hashString(str: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

/**
 * Generate a vector embedding for text using hash-based vectorization
 */
export function embedText(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const vector = new Float64Array(VECTOR_DIM);

  // Generate features from word hashes
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let d = 0; d < VECTOR_DIM; d++) {
      const seed = d * 31 + 7;
      const h = hashString(word, seed);
      vector[d] += Math.sin(h) / (i + 1);
    }
  }

  // Add character n-gram features
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= normalized.length - n; i++) {
      const ngram = normalized.substring(i, i + n);
      for (let d = 0; d < VECTOR_DIM; d++) {
        const seed = d * 17 + n * 53;
        const h = hashString(ngram, seed);
        vector[d] += Math.cos(h) * 0.1;
      }
    }
  }

  // Normalize vector to unit length
  let norm = 0;
  for (let d = 0; d < VECTOR_DIM; d++) {
    norm += vector[d] * vector[d];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let d = 0; d < VECTOR_DIM; d++) {
      vector[d] /= norm;
    }
  }

  return Array.from(vector);
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}
