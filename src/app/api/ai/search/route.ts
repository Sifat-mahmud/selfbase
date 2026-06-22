import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { embedText, cosineSimilarity } from '@/lib/embedding';

/**
 * POST /api/ai/search - Semantic search using embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid request body');

    const { query, tableId, topK = 10, threshold = 0.5 } = body;

    if (!query) {
      return errorResponse('query is required');
    }

    // Generate query embedding
    const queryVector = embedText(query);

    // Fetch embeddings from database
    const where: any = {};
    if (tableId) where.tableId = tableId;

    const embeddings = await db.embedding.findMany({
      where,
      include: {
        row: {
          select: { id: true, data: true, tableId: true },
        },
      },
    });

    // Compute similarities
    const results = embeddings
      .map((emb) => {
        let storedVector: number[];
        try {
          storedVector = JSON.parse(emb.vector);
        } catch {
          return null;
        }
        const score = cosineSimilarity(queryVector, storedVector);
        return {
          rowId: emb.rowId,
          tableId: emb.tableId,
          score,
          textContent: emb.textContent,
          rowData: emb.row ? JSON.parse(emb.row.data) : null,
          model: emb.model,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return successResponse({
      query,
      totalCandidates: embeddings.length,
      results,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
