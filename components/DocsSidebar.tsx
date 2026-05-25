'use client';
import { useEffect, useState } from 'react';
import { HowItWorks } from '@/content/how-it-works';

/**
 * Floating "How this works" pill that opens a right-side drawer with the
 * tour content. Default closed. Body scroll is locked while the drawer is
 * open. Esc and a backdrop click close it.
 */
export function DocsSidebar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the guided tour"
        aria-expanded={open}
        className={`fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <BookIcon className="h-4 w-4" />
        <span>How this works</span>
      </button>

      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="How this demo works"
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl transition-transform sm:w-[480px] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-wider text-slate-500">
              Guided tour
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
              How this demo works
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              A walkthrough of the Polyguard SDK integration on this page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close the guided tour"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-100"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <HowItWorks />
        </div>
      </aside>
    </>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
