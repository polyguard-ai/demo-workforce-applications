/**
 * Pulls a Jotform-built form into our page as same-origin HTML.
 *
 * Jotform's JS Embed endpoint (`/jsform/<id>`) doesn't return inline form
 * HTML anymore — it returns a `FrameBuilder` class that constructs an
 * iframe at runtime. To stay iframe-free we instead fetch the full
 * Jotform-rendered form page at `https://form.jotform.com/<id>` and
 * extract the `<form>` element plus the assets it depends on:
 * stylesheet `<link>`s, inline `<style>` blocks, and every `<script>`
 * that appears before the form (which is where Jotform defines the
 * `JotForm` global the form's own inline scripts call into).
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
    // Always fetch fresh: the operator is actively iterating on the form
    // in Jotform's builder, and a 1-hour ISR window hides their edits.
    cache: 'no-store',
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

  const formMatch = html.match(
    /<form\b[^>]*class="[^"]*jotform-form[^"]*"[^>]*>[\s\S]*?<\/form>/,
  );
  if (!formMatch || formMatch.index === undefined) return null;
  const form = formMatch[0];

  // The form body contains inline `<script>JotForm.foo(...)</script>`
  // blocks that reference a `JotForm` global. Jotform sets that global
  // up in loader `<script src="…/jotform.forms.js">` tags that live in
  // `<head>` and at the top of `<body>` — *before* the form. Collect
  // every `<script>` that appears before the form so those loaders run
  // first; otherwise the browser parses the inline scripts and throws
  // `ReferenceError: JotForm is not defined`.
  const scriptsBefore =
    html.slice(0, formMatch.index).match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? [];

  // Rewrite protocol-relative font URLs (`//cdn.jotfor.ms/...`) so the
  // browser picks https — Jotform sometimes serves them protocol-relative
  // and that fails on https pages without quirks.
  const resolved = [...links, ...styles, ...scriptsBefore, form]
    .join('\n')
    .replace(/(href|src)="\/\//g, '$1="https://');

  return resolved;
}
