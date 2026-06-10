// services/gateway/src/index.ts
// SelfBase API Gateway — entry point
// Handles: JWT auth, rate limiting, priority routing, load shedding queue

import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import fcors from '@fastify/cors';
import frate from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import { loadConfig } from './config';
import { priorityMiddleware } from './priority';
import { queueRouter } from './queue';

const config = loadConfig();
const redis = new Redis(process.env.REDIS_URL!);

const app = Fastify({ logger: true });

// ── Plugins ──────────────────────────────────────────────────────────────────
await app.register(fcors, {
  origin: config.cors.allowed_origins,
  credentials: true,
});

await app.register(frate, {
  redis,
  max: config.rate_limiting.max_requests,
  timeWindow: config.rate_limiting.window_ms,
});

await app.register(fjwt, {
  secret: process.env.JWT_SECRET!,
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', version: '0.1.0-alpha' }));

// ── Version check (local-first sync) ─────────────────────────────────────────
app.head('/api/v1/version/:table', async (req, reply) => {
  const { table } = req.params as { table: string };
  // TODO: fetch version hash from _selfbase_table_versions
  reply.header('etag', `"placeholder-${table}"`);
  return reply.code(200).send();
});

// ── Priority-aware data routes ────────────────────────────────────────────────
app.addHook('preHandler', priorityMiddleware(redis, config));
app.register(queueRouter, { prefix: '/api/v1' });

// ── Start ─────────────────────────────────────────────────────────────────────
const port = parseInt(process.env.GATEWAY_PORT || '3000');
await app.listen({ port, host: '0.0.0.0' });
console.log(`SelfBase gateway running on :${port}`);
