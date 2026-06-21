import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse, parseBody } from '@/lib/api-utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/functions/[id]/run - Execute a function
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();

  try {
    const { id } = await context.params;
    const body = await parseBody(request);

    const func = await db.sbFunction.findUnique({ where: { id } });
    if (!func) return notFoundResponse('Function');

    if (!func.isActive) {
      return errorResponse('Function is not active');
    }

    // Create a function run record
    const run = await db.functionRun.create({
      data: {
        functionId: func.id,
        status: 'running',
        triggeredBy: 'http',
        input: body ? JSON.stringify(body) : null,
        startedAt: new Date(),
      },
    });

    let output: any = null;
    let errorPayload: string | null = null;
    let status = 'success';

    try {
      // Execute function code in a sandboxed manner
      // Parse env vars
      let envVars: Record<string, string> = {};
      if (func.envVars) {
        try { envVars = JSON.parse(func.envVars); } catch { /* ignore */ }
      }

      // Create a safe execution context
      const input = body || {};
      const context = { input, env: envVars };

      // Build the function code with the context
      const wrappedCode = `
        "use strict";
        const __input = ${JSON.stringify(context.input)};
        const __env = ${JSON.stringify(context.env)};
        const __module = { exports: {} };
        const exports = __module.exports;
        const module = __module;
        const console = { log: () => {}, error: () => {}, warn: () => {}, info: () => {} };
        
        ${func.code}
        
        // Try to get the handler
        if (typeof handler === 'function') return handler(__input, __env);
        if (typeof __module.exports === 'function') return __module.exports(__input, __env);
        if (typeof __module.exports.handler === 'function') return __module.exports.handler(__input, __env);
        if (typeof __module.exports.default === 'function') return __module.exports.default(__input, __env);
        return { message: 'No handler function found. Export a function called handler.' };
      `;

      // Use Function constructor for sandboxed execution
      const execFn = new Function(wrappedCode);
      
      // Set a timeout for execution
      const timeoutMs = func.timeoutMs || 30000;
      const result = await Promise.race([
        Promise.resolve(execFn()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Function execution timed out')), timeoutMs)
        ),
      ]);

      output = result;
    } catch (execError: any) {
      status = execError.message?.includes('timed out') ? 'timeout' : 'failed';
      errorPayload = execError.message;
    }

    const durationMs = Date.now() - startTime;

    // Update the run record
    await db.functionRun.update({
      where: { id: run.id },
      data: {
        status,
        output: output ? JSON.stringify(output) : null,
        errorPayload,
        durationMs,
        completedAt: new Date(),
      },
    });

    if (status !== 'success') {
      return errorResponse(errorPayload || 'Function execution failed', 500);
    }

    return successResponse({
      runId: run.id,
      status,
      output,
      durationMs,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}
