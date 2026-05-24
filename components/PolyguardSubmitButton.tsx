'use client';
import { useState, type RefObject } from 'react';
import {
  runPolyguardVerify,
  PolyguardCancelled,
} from '@/lib/run-polyguard-verify';

type Phase =
  | { name: 'idle' }
  | { name: 'verifying' }
  | { name: 'awaiting-webhook'; linkUuid: string; rawJwt: string }
  | { name: 'submitting' }
  | { name: 'failed'; reason: string };

type Props = {
  formContainerRef: RefObject<HTMLDivElement | null>;
  onSubmitted: () => void;
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

    setPhase({ name: 'verifying' });
    let linkUuid: string;
    let rawJwt: string;
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
    jwtInput.value = rawJwt;

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

    onSubmitted();
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

async function pollForWebhook(linkUuid: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`/api/status/${encodeURIComponent(linkUuid)}`, {
      cache: 'no-store',
    });
    if (res.status === 200) {
      return (await res.json()) as {
        event: 'trust_check.completed' | 'trust_check.failed';
        data?: { reason?: string | null };
      };
    }
    if (res.status !== 204) {
      throw new Error(`Status endpoint returned ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Timed out waiting for Polyguard webhook');
}
