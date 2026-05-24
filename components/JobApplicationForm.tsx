'use client';
import { useRef, useState } from 'react';
import { PolyguardSubmitButton } from './PolyguardSubmitButton';

type Props = {
  jotformId: string;
};

/**
 * Renders the candidate-facing job application page: a Jotform embedded as
 * an iframe, with Jotform's native submit hidden, and our own "Submit with
 * Polyguard" button below it.
 *
 * The Jotform form is expected to:
 *   1. contain a hidden field whose unique name is `polyguard_jwt`.
 *   2. hide its native submit button via Jotform → Conditions, OR have
 *      Custom Code injected that hides `#input_2` / its submit input on
 *      load.
 *   3. listen for `postMessage` from the parent and submit when it
 *      receives `{ type: 'polyguard-submit', polyguard_jwt: '...' }`.
 *
 * See README → "Configure your Jotform" for the Custom Code snippet.
 */
export function JobApplicationForm({ jotformId }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!jotformId) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-medium">No Jotform ID configured.</p>
        <p className="mt-2">
          Set <code className="font-mono">NEXT_PUBLIC_JOTFORM_ID</code> in your
          <code className="font-mono"> .env.local</code> to point at your job
          application form. See <code className="font-mono">README.md</code> for
          how to build the form in Jotform.
        </p>
      </div>
    );
  }

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
      <iframe
        ref={iframeRef}
        title="Job application"
        src={`https://form.jotform.com/${encodeURIComponent(jotformId)}`}
        className="block w-full min-h-[680px] rounded-lg border border-slate-200 bg-white"
        // Jotform serves these features; allow them so file upload / camera
        // prompts work if the form needs them.
        allow="geolocation; microphone; camera; fullscreen"
        scrolling="no"
      />

      <PolyguardSubmitButton
        iframeRef={iframeRef}
        onSubmitted={() => setSubmitted(true)}
      />
    </div>
  );
}
