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
    // Hide Jotform's native submit. The candidate's only path forward is
    // the page-level "Submit with Polyguard" button.
    const submits = container.querySelectorAll<HTMLElement>(
      'button[type="submit"], input[type="submit"], .form-submit-button, .form-submit-button-container',
    );
    submits.forEach((el) => {
      el.style.display = 'none';
    });
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
