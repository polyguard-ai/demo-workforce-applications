/**
 * Pulls a Jotform-built form into our page as same-origin HTML.
 *
 * Jotform's JS Embed endpoint (`/jsform/<id>`) doesn't return inline form
 * HTML anymore — it returns a `FrameBuilder` class that constructs an
 * iframe at runtime. To stay iframe-free we instead fetch the full
 * Jotform-rendered form page at `https://form.jotform.com/<id>` and
 * extract the `<form>` element plus the stylesheet `<link>`s and inline
 * `<style>` blocks it depends on for styling.
 *
 * The form's `action` attribute already points at
 * `https://submit.jotform.com/submit/<id>`, so when we set the
 * `polyguard_jwt` input and POST the form, the submission lands in the
 * Jotform Inbox exactly as a native submit would.
 *
 * Returns the assembled HTML, or `null` if the form ID is missing /
 * unpublished. Throws on network errors so the page can render a clear
 * error state.
 */
export async function fetchJotformHtml(formId: string): Promise<string | null> {
  const url = `https://form.jotform.com/${encodeURIComponent(formId)}`;
  const res = await fetch(url, {
    headers: {
      // Jotform serves a stripped response to unknown user agents.
      'User-Agent':
        'Mozilla/5.0 (compatible; demo-workforce-applications/1.0; +https://github.com/polyguard-ai/demo-workforce-applications)',
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Jotform returned ${res.status} for form ${formId}`);
  }
  const html = await res.text();

  if (html.includes('missing-form') || !html.includes('jotform-form')) {
    return null;
  }

  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/)?.[1] ?? '';
  const links = head.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? [];
  const styles = head.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) ?? [];
  const form = html.match(
    /<form\b[^>]*class="[^"]*jotform-form[^"]*"[^>]*>[\s\S]*?<\/form>/,
  )?.[0];
  if (!form) return null;

  // Rewrite protocol-relative font URLs (`//cdn.jotfor.ms/...`) so the
  // browser picks https — Jotform sometimes serves them protocol-relative
  // and that fails on https pages without quirks.
  const resolved = [...links, ...styles, form]
    .join('\n')
    .replace(/(href|src)="\/\//g, '$1="https://');

  return resolved;
}
