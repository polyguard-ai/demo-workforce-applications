import { JobApplicationForm } from '@/components/JobApplicationForm';

export default function Page() {
  const jotformId = process.env.NEXT_PUBLIC_JOTFORM_ID ?? '';

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Polyguard demo · Workforce Applications
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Apply for this role
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Identity is confirmed with Polyguard before your application is sent.
          You will be asked to complete a quick Trust Check on your phone when
          you submit. Your biometric data never leaves your device.
        </p>
      </header>

      <JobApplicationForm jotformId={jotformId} />

      <footer className="mt-12 text-xs text-slate-500">
        <p>
          Privacy First — Polyguard verifies who you are without ever storing
          your face or document images on our servers.
        </p>
      </footer>
    </main>
  );
}
