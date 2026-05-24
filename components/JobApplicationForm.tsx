'use client';
import { useEffect, useRef, useState } from 'react';
import { PolyguardSubmitButton } from './PolyguardSubmitButton';

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
  const [submitted, setSubmitted] = useState(false);

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
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-8 text-emerald-900">
        <h2 className="text-xl font-semibold">Application submitted.</h2>
        <p className="mt-3 text-sm">
          Your identity has been verified and your application has been sent.
          We&apos;ll be in touch.
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
        onSubmitted={() => setSubmitted(true)}
      />
    </div>
  );
}
