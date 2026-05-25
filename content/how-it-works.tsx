/**
 * Sidebar tour content: a walkthrough of what's happening on this page and
 * how the Polyguard SDK integration is wired up. Kept as a TSX component
 * (rather than MDX) because this demo only has the one page to document —
 * adding an MDX toolchain for a single file isn't worth the dependency
 * footprint. Edit the prose here.
 */
export function HowItWorks() {
  return (
    <article className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          The premise
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          A job-application page where the candidate&apos;s submission is gated
          on a successful <strong>Polyguard Trust Check</strong>. The form is
          built in Jotform; the submission is held in the browser until the
          candidate has verified their authentic identity, location, and
          on-device attestation through the Polyguard SDK.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Use this as a reference for{' '}
          <strong>Talent / Recruiting</strong> integrations — wherever a
          business needs to confirm the person on the other end of an
          application is real before accepting their data into the pipeline.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          The flow
        </h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            The page fetches your Jotform via Jotform&apos;s JS Embed
            endpoint (<code className={CODE}>/jsform/&lt;FORM_ID&gt;</code>)
            server-side, evaluates the script in a sandbox, and renders the
            resulting HTML inline. The form lives same-origin in our DOM —{' '}
            <strong>no iframe</strong>, so no cross-origin restrictions to
            work around and nothing to paste inside Jotform.
          </li>
          <li>
            Jotform&apos;s native submit button is hidden on mount. The only
            path forward is the page-level{' '}
            <strong>&ldquo;Submit with Polyguard&rdquo;</strong> button.
          </li>
          <li>
            Clicking the button opens the Polyguard SDK modal. The candidate
            completes a Trust Check on their phone (face + document + region +
            on-device attestation — biometric data never leaves their device).
          </li>
          <li>
            The SDK resolves with a verification bundle. The page polls{' '}
            <code className={CODE}>/api/status/&#123;linkUuid&#125;</code>{' '}
            until the matching encrypted webhook lands at{' '}
            <code className={CODE}>/api/webhook</code> and is decrypted
            server-side.
          </li>
          <li>
            On <code className={CODE}>trust_check.completed</code>, the page
            packs the verified claims into the form&apos;s hidden{' '}
            <code className={CODE}>polyguard_jwt</code> input, builds{' '}
            <code className={CODE}>FormData</code>, and POSTs it to
            Jotform&apos;s submission endpoint. The submission appears in your
            Jotform Inbox exactly as a native submission would.
          </li>
        </ol>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          The SDK integration
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          A single client component dynamically imports{' '}
          <code className={CODE}>@polyguard/sdk</code> and calls{' '}
          <code className={CODE}>client.verify()</code>:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
          <code>{`const { PolyguardClient } = await import('@polyguard/sdk');

const client = new PolyguardClient({
  appId: process.env.NEXT_PUBLIC_POLYGUARD_APP_ID,
  apiServer: 'api.polyguard.ai',
  requiredProofs: ['pg_presence'],
  scanType: 'multi',
});

const response = await client.verify(
  'pg-qr-target',
  /* rawJwt */ true,
);`}</code>
        </pre>
        <p className="mt-2 text-sm text-slate-700">
          The dynamic <code className={CODE}>import()</code> keeps the SDK
          (and its bundled deps — qrcode, reconnecting-websocket, superagent)
          out of the initial page chunk and out of SSR.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          What Polyguard Mobile does
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          When the candidate scans the QR (or taps the deep link), Polyguard
          Mobile runs a fused identity verification — up to four factors
          confirmed in a single Trust Check:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>
            <strong>Person</strong> — 3D depth facial recognition on the
            candidate&apos;s device.
          </li>
          <li>
            <strong>Document</strong> — NFC chip verification of the
            government ID. Not OCR.
          </li>
          <li>
            <strong>Device</strong> — Apple AppAttest or Google Play
            Integrity confirms a real, untampered phone.
          </li>
          <li>
            <strong>Location</strong> — GPS plus PG-Presence optical distance
            bounding confirms the candidate is physically there, in real
            time.
          </li>
        </ol>
        <p className="mt-2 text-sm text-slate-700">
          Biometric data never leaves the device. The recruiter never sees
          it. Polyguard never stores it.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          The webhook side
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          In parallel with the SDK response, Polyguard&apos;s backend posts an
          AES-256-GCM-encrypted webhook to{' '}
          <code className={CODE}>/api/webhook</code>. The route decrypts it
          with <code className={CODE}>POLYGUARD_WEBHOOK_SECRET</code>, checks
          the replay window, and stores the payload by{' '}
          <code className={CODE}>link_uuid</code> (Upstash Redis in
          production, in-memory map for{' '}
          <code className={CODE}>next dev</code>).
        </p>
        <p className="mt-2 text-sm text-slate-700">
          The browser polls <code className={CODE}>/api/status/...</code> for
          the matching payload. This split is on purpose: the SDK response is
          fast enough for UX, the encrypted webhook is tamper-evident enough
          for the audit trail.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Why this matters for hiring
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          Application fraud and identity-fronted talent rings are a growing
          problem for recruiting teams — and an even bigger one for the
          companies who hire those candidates. Confirming the person behind
          the application before their data enters the ATS pipeline closes
          that attack surface at the funnel stage, without adding friction
          for legitimate candidates.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Learn more
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <a
              href="https://polyguard.ai"
              target="_blank"
              rel="noreferrer"
              className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
            >
              Why Polyguard
            </a>
          </li>
          <li>
            <a
              href="https://docs.polyguard.ai"
              target="_blank"
              rel="noreferrer"
              className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
            >
              Polyguard developer docs
            </a>
          </li>
          <li>
            <a
              href="https://github.com/polyguard-ai/demo-workforce-applications"
              target="_blank"
              rel="noreferrer"
              className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
            >
              Source on GitHub
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}

const CODE =
  'rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800';
