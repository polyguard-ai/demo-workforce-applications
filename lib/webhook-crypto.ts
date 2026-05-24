import { createDecipheriv } from 'node:crypto';

export type WebhookEnvelope = {
  v: number;
  payload: string; // base64(iv || ciphertext || tag)
};

export type VerificationClaims = {
  sub?: string;
  region?: string;
  document_type?: string;
  full_name?: string;
  id_verification_id?: string;
  age?: number;
  phone_number?: string;
  phone_number_verification_id?: string;
  verified_by?: string;
  certainty?: number;
  hardware_attestation_id?: string;
  photo_verification_url?: string;
  issuing_country?: string;
  presence?: { score: string | number };
  iat?: number;
  [k: string]: unknown;
};

export type WebhookInner = {
  timestamp: number;
  event: 'trust_check.completed' | 'trust_check.failed';
  app_id: string;
  link_uuid: string;
  data: {
    reason: string | null;
    sub: string | null;
    verification: VerificationClaims;
    affidavit_url: string;
    affidavit_uuid: string;
  };
};

const IV_BYTES = 12;
const TAG_BYTES = 16;
const REPLAY_WINDOW_SECONDS = 300;

export class WebhookCryptoError extends Error {}

export function decryptWebhook(
  envelope: WebhookEnvelope,
  secretBase64: string,
  now: number = Math.floor(Date.now() / 1000),
): WebhookInner {
  if (envelope.v !== 1) {
    throw new WebhookCryptoError('Unsupported envelope version');
  }
  const key = Buffer.from(secretBase64, 'base64');
  if (key.length !== 32) {
    throw new WebhookCryptoError('POLYGUARD_WEBHOOK_SECRET must be 32 bytes (base64-encoded)');
  }

  const blob = Buffer.from(envelope.payload, 'base64');
  if (blob.length < IV_BYTES + TAG_BYTES) {
    throw new WebhookCryptoError('Payload too short');
  }
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES, blob.length - TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new WebhookCryptoError('Authentication tag verification failed');
  }

  let inner: WebhookInner;
  try {
    inner = JSON.parse(plaintext.toString('utf8'));
  } catch {
    throw new WebhookCryptoError('Decrypted payload is not valid JSON');
  }

  if (typeof inner.timestamp !== 'number') {
    throw new WebhookCryptoError('Inner payload missing timestamp');
  }
  if (Math.abs(now - inner.timestamp) > REPLAY_WINDOW_SECONDS) {
    throw new WebhookCryptoError('Webhook timestamp outside replay window');
  }
  if (!inner.link_uuid || typeof inner.link_uuid !== 'string') {
    throw new WebhookCryptoError('Inner payload missing link_uuid');
  }
  return inner;
}
