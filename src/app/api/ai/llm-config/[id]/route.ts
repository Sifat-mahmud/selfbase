import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, parseBody } from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/ai/llm-config/[id] - Update an LLM provider
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid request body');

    const existing = await db.llmConfig.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('LLM config');

    const updateData: any = {};
    if (body.provider !== undefined) updateData.provider = body.provider;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.baseUrl !== undefined) updateData.baseUrl = body.baseUrl;
    if (body.apiKey !== undefined) updateData.apiKey = body.apiKey;
    if (body.modelName !== undefined) updateData.modelName = body.modelName;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.costPer1kInput !== undefined) updateData.costPer1kInput = body.costPer1kInput;
    if (body.costPer1kOutput !== undefined) updateData.costPer1kOutput = body.costPer1kOutput;

    const config = await db.llmConfig.update({
      where: { id },
      data: updateData,
    });

    return successResponse({
      ...config,
      apiKey: config.apiKey ? config.apiKey.substring(0, 8) + '...' : null,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

/**
 * DELETE /api/ai/llm-config/[id] - Delete an LLM provider
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existing = await db.llmConfig.findUnique({ where: { id } });
    if (!existing) return notFoundResponse('LLM config');

    await db.llmConfig.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
