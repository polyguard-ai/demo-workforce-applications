'use client';
import {
  POLYGUARD_API_SERVER,
  POLYGUARD_APP_ID,
  REQUIRED_PROOFS_FOR_APPLICATION,
  extractLinkUuid,
  type PolyguardJwtBundle,
  type PolyguardVerifyResponse,
} from './polyguard';
import { loadPolyguardClient } from './load-polyguard';

export class PolyguardCancelled extends Error {
  constructor() {
    super('User cancelled');
    this.name = 'PolyguardCancelled';
  }
}

export type ApplicationVerifyResult = {
  linkUuid: string;
  rawJwt: string;
  bundle: PolyguardJwtBundle;
};

/**
 * Runs a Polyguard verification for a job-application submission. Uses the
 * SDK's built-in full-screen modal (no `target`) so the candidate stays on
 * the application page.
 *
 * Resolves with `{ linkUuid, rawJwt, bundle }`. Throws `PolyguardCancelled`
 * if the user closes the modal. Throws a generic `Error` for any other
 * failure (offline, missing bundle, missing redirect_url).
 */
export async function runPolyguardVerify(): Promise<ApplicationVerifyResult> {
  const Client = await loadPolyguardClient();
  const client = new Client({
    appId: POLYGUARD_APP_ID,
    apiServer: POLYGUARD_API_SERVER,
    requiredProofs: REQUIRED_PROOFS_FOR_APPLICATION,
    scanType: 'multi',
  });

  let response: PolyguardVerifyResponse;
  try {
    response = (await client.verify(undefined, true)) as PolyguardVerifyResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(msg)) throw new PolyguardCancelled();
    throw err;
  }

  const bundle = response?.jwt;
  if (!bundle || typeof bundle !== 'object') {
    const offlineMsg =
      (response as { presence?: { msg?: string } } | undefined)?.presence?.msg;
    throw new Error(offlineMsg || 'Polyguard returned no verification bundle');
  }

  const linkUuid = extractLinkUuid(response);
  if (!linkUuid) {
    throw new Error(
      'Polyguard verification bundle missing redirect_url; could not derive link_uuid',
    );
  }

  const rawJwt = typeof bundle.raw_jwt === 'string' ? bundle.raw_jwt : '';
  if (!rawJwt) {
    throw new Error('Polyguard verification bundle missing raw_jwt');
  }

  return { linkUuid, rawJwt, bundle };
}
