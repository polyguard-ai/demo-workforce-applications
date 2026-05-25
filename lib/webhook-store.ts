import { Redis } from '@upstash/redis';
import type { WebhookInner } from './webhook-crypto';

/**
 * Webhook payload store.
 *
 * Production (Vercel): Upstash Redis. The Polyguard webhook arrives in one
 * serverless function and the client poll lands in a different one, so a
 * module-scoped Map is invisible across them.
 *
 * Local development: if no Redis env vars are present we fall back to an
 * in-process Map, which works fine because `next dev` is a single process.
 *
 * Env var names: Vercel's Marketplace integration for Upstash injects
 * `KV_REST_API_URL` / `KV_REST_API_TOKEN` (inherited from the legacy
 * Vercel KV product). A manual Upstash setup uses
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Accept either.
 */

const REDIS_URL =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SECONDS = 60 * 30;
const KEY_PREFIX = 'workforce-applications:webhook:';

const redis: Redis | null =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

const memoryStore = new Map<string, WebhookInner>();
const MAX_MEMORY_ENTRIES = 200;

export async function setPayload(payload: WebhookInner): Promise<void> {
  if (redis) {
    await redis.set(KEY_PREFIX + payload.link_uuid, payload, { ex: TTL_SECONDS });
    return;
  }
  if (memoryStore.size >= MAX_MEMORY_ENTRIES) {
    const firstKey = memoryStore.keys().next().value;
    if (firstKey) memoryStore.delete(firstKey);
  }
  memoryStore.set(payload.link_uuid, payload);
}

export async function getPayload(linkUuid: string): Promise<WebhookInner | undefined> {
  if (redis) {
    const payload = await redis.get<WebhookInner>(KEY_PREFIX + linkUuid);
    return payload ?? undefined;
  }
  return memoryStore.get(linkUuid);
}

export function isUsingRedis(): boolean {
  return redis !== null;
}
