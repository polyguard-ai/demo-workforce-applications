'use client';
import { useEffect, useRef, useState } from 'react';
import { PolyguardSubmitButton, type VerifiedIdentity } from './PolyguardSubmitButton';

type Props = {
  /** HTML body returned by `lib/fetch-jotform.ts` — the form, same-origin. */
  formHtml: string;
};

/**
 * Renders a Jotform-built application form *inline* in our DOM (not in an
 * iframe). The HTML comes from Jotform's JS Embed endpoint, evaluated
 * server-side. Because the form is same-origin, we can reach into it from
 * the page: hide the native submit, find the `polyguard_jwt` input, and
 * submit programmatically once the Trust Check passes.
 */
export function JobApplicationForm({ formHtml }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [submitted, setSubmitted] = useState<VerifiedIdentity | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const form = container.querySelector<HTMLFormElement>('form.jotform-form, form');
    if (!form) return;

    // Lock every path a candidate could use to submit *without*
    // completing a Polyguard Trust Check. The only authorized path is
    // `PolyguardSubmitButton`'s click handler, which builds FormData
    // and POSTs to `form.action` via fetch after a successful verify.
    //
    // We can't stop a determined attacker who opens DevTools and POSTs
    // to `form.action` themselves — that's outside our control, and the
    // recruiter is expected to verify the `raw_jwt` signature against
    // Polyguard's JWKS server-side — but we close every accidental,
    // implicit, and casual-tamper path.

    // (a) Disarm every submit-eligible element: hide it, change its
    //     `type` so Enter-key implicit submission has no default button
    //     to fire, and `disabled` it so a scripted `.click()` is inert.
    const submits = container.querySelectorAll<HTMLElement>(
      [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:not([type])', // bare <button> defaults to type=submit per HTML spec
        '.form-submit-button',
        '.form-submit-button-container',
      ].join(', '),
    );
    submits.forEach((el) => {
      el.style.display = 'none';
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.type = 'button';
        el.disabled = true;
      }
    });

    // (b) Cancel any submit event that fires anyway — implicit
    //     submission via Enter, Jotform's own JS dispatching submit,
    //     or anything we haven't anticipated. Our own POST goes
    //     through `fetch` + FormData and never dispatches submit.
    const blockSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    form.addEventListener('submit', blockSubmit, true);

    // (c) Override `form.submit()`. The imperative method bypasses the
    //     submit event entirely (per HTML spec), so the listener above
    //     can't catch it. Throwing here neutralizes Jotform's own JS
    //     calling `.submit()` and a casual `document.forms[0].submit()`
    //     from the console.
    const originalSubmit = form.submit.bind(form);
    form.submit = () => {
      throw new Error('Form submission is gated by Polyguard.');
    };

    // (d) Wipe any prefilled `polyguard_jwt`. Jotform's JS reads URL
    //     parameters and populates matching field names, so a candidate
    //     arriving at `/?polyguard_jwt=forged` would otherwise have a
    //     pre-poisoned value sitting in the field before our flow
    //     overwrites it.
    const jwtInput = form.querySelector<HTMLInputElement>(
      'input[name*="polyguard_jwt" i], input[name*="polyguardJwt" i], input[name*="polyguard" i]',
    );
    if (jwtInput) jwtInput.value = '';

    return () => {
      form.removeEventListener('submit', blockSubmit, true);
      form.submit = originalSubmit;
    };
  }, [formHtml]);

  if (submitted) {
    const v = submitted;
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-8 text-emerald-900">
        <h2 className="text-xl font-semibold">Application submitted.</h2>
        {v.fullName ? (
          <p className="mt-3 text-sm">
            Polyguard verified you as <strong>{v.fullName}</strong>
            {v.region ? <> in <strong>{v.region}</strong></> : null}
            {' '}and your application has been sent to the recruiter.
          </p>
        ) : (
          <p className="mt-3 text-sm">
            Your identity has been verified and your application has been sent.
          </p>
        )}
        <dl className="mt-5 grid grid-cols-1 gap-1 text-xs text-emerald-800 sm:grid-cols-2">
          {v.documentType ? (
            <>
              <dt className="font-medium">Document</dt>
              <dd>{v.documentType}{v.issuingCountry ? ` (${v.issuingCountry})` : ''}</dd>
            </>
          ) : null}
          <dt className="font-medium">Verification ID</dt>
          <dd className="font-mono break-all">{v.linkUuid}</dd>
        </dl>
        <p className="mt-4 text-xs text-emerald-700">
          The recruiter sees these claims attached to your Jotform submission,
          plus the verification ID for cross-referencing in the Polyguard
          dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        ref={containerRef}
        // The form's own classes / inline styles do the heavy lifting; the
        // wrapper just provides a card around it.
        className="jotform-host rounded-lg border border-slate-200 bg-white p-4"
        dangerouslySetInnerHTML={{ __html: formHtml }}
      />

      <PolyguardSubmitButton
        formContainerRef={containerRef}
        onSubmitted={(verified) => setSubmitted(verified)}
      />
    </div>
  );
}
