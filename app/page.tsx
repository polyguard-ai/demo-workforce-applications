import { DocsSidebar } from '@/components/DocsSidebar';
import { JobApplicationForm } from '@/components/JobApplicationForm';
import { Shell } from '@/components/Shell';
import { fetchJotformHtml } from '@/lib/fetch-jotform';

export default async function Page() {
  const jotformId = process.env.NEXT_PUBLIC_JOTFORM_ID ?? '';

  let body: React.ReactNode;
  if (!jotformId) {
    body = (
      <SetupNotice
        title="No Jotform ID configured."
        detail={
          <>
            Set <code>NEXT_PUBLIC_JOTFORM_ID</code> in <code>.env.local</code> to
            the form ID of your Jotform job application. See <code>README.md</code>
            for how to build the form.
          </>
        }
      />
    );
  } else {
    let formHtml: string | null = null;
    let fetchError: string | null = null;
    try {
      formHtml = await fetchJotformHtml(jotformId);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : 'Unknown error';
    }

    if (fetchError) {
      body = (
        <SetupNotice
          title="Could not load the application form from Jotform."
          detail={<code className="text-xs">{fetchError}</code>}
        />
      );
    } else if (!formHtml) {
      body = (
        <SetupNotice
          title={`Jotform form ${jotformId} not found or unpublished.`}
          detail={
            <>
              Double-check the form ID and make sure the form is published.
            </>
          }
        />
      );
    } else {
      body = <JobApplicationForm formHtml={formHtml} />;
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Apply for this role
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Verified candidates only.
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Identity is confirmed with Polyguard before your application is
            sent. You will be asked to complete a quick Trust Check on your
            phone when you submit. Your biometric data never leaves your
            device.
          </p>
        </header>

        {body}

        <p className="mt-12 text-xs text-slate-500">
          Privacy First — Polyguard verifies who you are without ever storing
          your face or document images on our servers.
        </p>
      </div>
      <DocsSidebar />
    </Shell>
  );
}

function SetupNotice({
  title,
  detail,
}: {
  title: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{detail}</p>
    </div>
  );
}
