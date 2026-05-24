'use client';
import type { PolyguardClientConstructor } from './polyguard';

let cached: Promise<PolyguardClientConstructor> | null = null;

/**
 * Dynamically imports `@polyguard/sdk` and returns the `PolyguardClient`
 * constructor. The dynamic import keeps the SDK (and its pre-bundled deps —
 * qrcode, reconnecting-websocket, superagent) out of the initial page chunk
 * and out of SSR (the SDK touches `window` at import time).
 */
export function loadPolyguardClient(): Promise<PolyguardClientConstructor> {
  if (cached) return cached;
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Polyguard SDK can only be loaded in the browser.'),
    );
  }
  cached = import('@polyguard/sdk').then((mod) => {
    const Client = (mod.PolyguardClient ??
      (mod as unknown as { default?: PolyguardClientConstructor }).default) as
      | PolyguardClientConstructor
      | undefined;
    if (!Client) {
      cached = null;
      throw new Error(
        '@polyguard/sdk loaded but PolyguardClient export is missing.',
      );
    }
    return Client;
  });
  cached.catch(() => {
    cached = null;
  });
  return cached;
}
