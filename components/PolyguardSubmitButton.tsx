'use client';
import { useState, type RefObject } from 'react';
import {
  runPolyguardVerify,
  PolyguardCancelled,
} from '@/lib/run-polyguard-verify';

type Phase =
  | { name: 'idle' }
  | { name: 'needs-fields'; missingLabel: string }
  | { name: 'verifying' }
  | { name: 'awaiting-webhook'; linkUuid: string; rawJwt: string | null }
  | { name: 'submitting' }
  | { name: 'failed'; reason: string };

export type VerifiedIdentity = {
  linkUuid: string;
  fullName?: string;
  region?: string;
  documentType?: string;
  issuingCountry?: string;
  verifiedAt?: number;
};

type Props = {
  formContainerRef: RefObject<HTMLDivElement | null>;
  onSubmitted: (verified: VerifiedIdentity) => void;
};

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * "Submit with Polyguard" button. State machine:
 *
 *   idle
 *     ↓ click
 *   verifying            — Polyguard SDK modal is open
 *     ↓ resolve
 *   awaiting-webhook     — verify resolved; wait for the decrypted webhook
 *                          to arrive at /api/status/{linkUuid}
 *     ↓ webhook says trust_check.completed
 *   submitting           — set the form's hidden polyguard_jwt input,
 *                          POST FormData to Jotform's submission endpoint
 *     ↓ done
 *   (parent shows the success screen)
 *
 * Any failure (cancel, OFFLINE, Warn/Fail/Did Not Complete, webhook
 * timeout) routes to `failed`, which renders a "Try again" button that
 * resets to `idle`.
 */
export function PolyguardSubmitButton({ formContainerRef, onSubmitted }: Props) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });

  async function handleClick() {
    const form = findForm(formContainerRef.current);
    if (!form) {
      setPhase({ name: 'failed', reason: 'Application form is not ready' });
      return;
    }

    const missing = findFirstMissingRequiredField(form);
    if (missing) {
      missing.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if ('focus' in missing.element) {
        try { (missing.element as HTMLElement).focus({ preventScroll: true }); } catch {}
      }
      setPhase({ name: 'needs-fields', missingLabel: missing.label });
      return;
    }

    setPhase({ name: 'verifying' });
    let linkUuid: string;
    let rawJwt: string | null;
    try {
      const result = await runPolyguardVerify();
      linkUuid = result.linkUuid;
      rawJwt = result.rawJwt;
    } catch (err) {
      if (err instanceof PolyguardCancelled) {
        setPhase({ name: 'idle' });
        return;
      }
      const reason = err instanceof Error ? err.message : 'Verification failed';
      setPhase({ name: 'failed', reason });
      return;
    }

    setPhase({ name: 'awaiting-webhook', linkUuid, rawJwt });

    let webhook;
    try {
      webhook = await pollForWebhook(linkUuid);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Webhook did not arrive';
      setPhase({ name: 'failed', reason });
      return;
    }

    if (webhook.event !== 'trust_check.completed') {
      setPhase({
        name: 'failed',
        reason: webhook.data?.reason ?? 'Trust check did not pass',
      });
      return;
    }

    setPhase({ name: 'submitting' });
    const jwtInput = findPolyguardJwtInput(form);
    if (!jwtInput) {
      setPhase({
        name: 'failed',
        reason: 'Form is missing a polyguard_jwt field. See README for setup.',
      });
      return;
    }

    // The webhook payload carries server-verified identity claims. Pack
    // the meaningful ones into a JSON blob alongside the link_uuid so the
    // recruiter reading the Jotform Inbox can see *who* verified, not
    // just an opaque identifier. The raw_jwt (when surfaced by the SDK)
    // goes in too so a downstream system that wants signature-verified
    // claims can re-derive them from JWKS.
    const verification = webhook.data?.verification ?? {};
    const verified: VerifiedIdentity = {
      linkUuid,
      fullName: typeof verification.full_name === 'string' ? verification.full_name : undefined,
      region: typeof verification.region === 'string' ? verification.region : undefined,
      documentType: typeof verification.document_type === 'string' ? verification.document_type : undefined,
      issuingCountry: typeof verification.issuing_country === 'string' ? verification.issuing_country : undefined,
      verifiedAt: webhook.timestamp,
    };

    jwtInput.value = JSON.stringify({
      link_uuid: verified.linkUuid,
      status: webhook.event,
      verified_at: verified.verifiedAt,
      verified_name: verified.fullName,
      verified_region: verified.region,
      verified_document_type: verified.documentType,
      verified_issuing_country: verified.issuingCountry,
      raw_jwt: rawJwt ?? undefined,
    });

    try {
      const fd = new FormData(form);
      // Jotform's submission endpoint doesn't return permissive CORS
      // headers, so we submit with no-cors and trust the network.
      await fetch(form.action, { method: 'POST', body: fd, mode: 'no-cors' });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Submission failed';
      setPhase({ name: 'failed', reason });
      return;
    }

    onSubmitted(verified);
  }

  if (phase.name === 'needs-fields') {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <div>
          <p className="font-medium">Please complete all required fields first.</p>
          <p className="mt-1 text-sm">
            Still needed: <strong>{phase.missingLabel}</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPhase({ name: 'idle' })}
          className="rounded-md bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Got it
        </button>
      </div>
    );
  }

  if (phase.name === 'failed') {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-900">
        <div>
          <p className="font-medium">Identity could not be verified.</p>
          <p className="mt-1 text-sm">{phase.reason}</p>
        </div>
        <button
          type="button"
          onClick={() => setPhase({ name: 'idle' })}
          className="rounded-md bg-rose-900 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
        >
          Try again
        </button>
      </div>
    );
  }

  const busy = phase.name !== 'idle';
  const label =
    phase.name === 'verifying'
      ? 'Verifying identity…'
      : phase.name === 'awaiting-webhook'
      ? 'Confirming verification…'
      : phase.name === 'submitting'
      ? 'Submitting application…'
      : 'Submit with Polyguard';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {label}
    </button>
  );
}

function findForm(container: HTMLElement | null): HTMLFormElement | null {
  if (!container) return null;
  return (
    container.querySelector<HTMLFormElement>('form.jotform-form') ??
    container.querySelector<HTMLFormElement>('form')
  );
}

/**
 * Jotform doesn't use HTML5 `required` — it marks required fields with
 * `class="validate[required]"` (its own validator's hook) and runs the
 * check in a script we don't execute. So `form.checkValidity()` always
 * returns true. Re-implement the check here: walk every required field,
 * group radio/checkbox by name, return the first one that's empty.
 */
function findFirstMissingRequiredField(
  form: HTMLFormElement,
): { element: HTMLElement; label: string } | null {
  const requiredEls = Array.from(
    form.querySelectorAll<HTMLElement>('[class*="validate[required]" i]'),
  );
  // Avoid validating a single radio/checkbox in a group more than once.
  const checkedGroups = new Set<string>();

  for (const el of requiredEls) {
    // Jotform's `setConditions` hides irrelevant questions by
    // display:none-ing the wrapping `.form-line`. `offsetParent === null`
    // catches that (display:none on the element itself or any ancestor).
    // Skip — the candidate can't fill in a question they can't see, and
    // forcing them to would deadlock the Trust Check.
    if (el.offsetParent === null) continue;

    const input = el as HTMLInputElement & {
      type?: string;
      name?: string;
      value?: string;
    };
    if (
      input.name &&
      (input.name.includes('polyguard_jwt') || input.name.includes('polyguard'))
    ) {
      // Set programmatically after Trust Check; not user input.
      continue;
    }

    if (input.type === 'radio' || input.type === 'checkbox') {
      const group = input.name || input.id || '';
      if (!group || checkedGroups.has(group)) continue;
      checkedGroups.add(group);
      const anyChecked = form.querySelector(
        `input[name="${cssEscape(group)}"]:checked`,
      );
      if (!anyChecked) {
        return { element: input, label: labelFor(form, input) };
      }
      continue;
    }

    const value = (input.value ?? '').trim();
    if (!value) {
      return { element: input, label: labelFor(form, input) };
    }
  }

  return null;
}

function labelFor(form: HTMLFormElement, input: HTMLElement): string {
  // 1. Walk up to the field container Jotform wraps each question in.
  //    The label text sits inside `.form-label`.
  const container = input.closest('li, .form-line');
  const labelEl =
    container?.querySelector<HTMLElement>('.form-label, label') ??
    form.querySelector<HTMLElement>(
      `label[for="${cssEscape((input as HTMLInputElement).id ?? '')}"]`,
    );
  const text = labelEl?.textContent?.replace(/\s+/g, ' ').trim();
  if (text) return text.replace(/\*$/, '').trim();
  return (input as HTMLInputElement).name || 'a required field';
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return s.replace(/(["\\])/g, '\\$1');
}

/**
 * Jotform names each input `q<QID>_<uniqueName>`. The unique name we ask
 * the demo operator to set is `polyguard_jwt` (or `polyguardJwt` — Jotform
 * sometimes camel-cases). Match on a substring so either works.
 */
function findPolyguardJwtInput(form: HTMLFormElement): HTMLInputElement | null {
  return (
    form.querySelector<HTMLInputElement>('input[name*="polyguard_jwt" i]') ??
    form.querySelector<HTMLInputElement>('input[name*="polyguardJwt" i]') ??
    form.querySelector<HTMLInputElement>('input[name*="polyguard" i]')
  );
}

type WebhookPayload = {
  event: 'trust_check.completed' | 'trust_check.failed';
  timestamp?: number;
  data?: {
    reason?: string | null;
    verification?: {
      full_name?: string;
      region?: string;
      document_type?: string;
      issuing_country?: string;
      [k: string]: unknown;
    };
  };
};

async function pollForWebhook(linkUuid: string): Promise<WebhookPayload> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/status/${encodeURIComponent(linkUuid)}`, {
      cache: 'no-store',
    });
    if (res.status === 200) {
      return (await res.json()) as WebhookPayload;
    }
    if (res.status !== 204) {
      throw new Error(`Status endpoint returned ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Timed out waiting for Polyguard webhook');
}
