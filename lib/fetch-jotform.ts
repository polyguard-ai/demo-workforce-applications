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

  // The `i` flag matches case variants (`<SCRIPT>`, `</STYLE>`) and
  // `[^>]*` before each closing `>` matches every browser-lenient
  // end-tag form (`</script >`, `</script\t\n garbage>`). Both
  // silence CodeQL's generic `js/bad-tag-filter` rule — that rule
  // targets sanitization contexts where a missed variant is a bypass;
  // here we're extracting (not stripping) tags and a missed variant
  // would just silently drop a script Jotform needs, but the broader
  // matcher is harmless and tracks the way browsers actually parse.
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head\b[^>]*>/i)?.[1] ?? '';
  const links = head.match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi) ?? [];
  const styles = head.match(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi) ?? [];

  const formMatch = html.match(
    /<form\b[^>]*class="[^"]*jotform-form[^"]*"[^>]*>[\s\S]*?<\/form\b[^>]*>/i,
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
    html.slice(0, formMatch.index).match(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi) ?? [];

  // Hide every native-submit path *before* JS has a chance to run, so
  // there's no window between SSR paint and `JobApplicationForm`'s
  // hydration effect where a candidate could click the native submit
  // and bypass Polyguard. The effect then layers stronger defenses
  // on top (type="button", disabled, submit-event blocker, .submit()
  // override). See `components/JobApplicationForm.tsx`.
  //
  // The footer rules suppress Jotform's "Powered by Jotform" bar
  // (`for-form-branding-footer.js`), which is appended to `document.body`
  // or the form and overlays our own footer and Submit button. This keeps
  // it from flashing in before `JobApplicationForm` removes it from the
  // DOM; these classes are unscoped because the bar lands outside the form.
  const armor = `<style>
    form.jotform-form button[type="submit"],
    form.jotform-form input[type="submit"],
    form.jotform-form button:not([type]),
    form.jotform-form .form-submit-button,
    form.jotform-form .form-submit-button-container {
      display: none !important;
    }
    .formFooter-wrapper,
    .formFooter,
    .formFooter-heightMask {
      display: none !important;
    }
  </style>`;

  // Rewrite protocol-relative font URLs (`//cdn.jotfor.ms/...`) so the
  // browser picks https — Jotform sometimes serves them protocol-relative
  // and that fails on https pages without quirks.
  const resolved = [...links, ...styles, armor, ...scriptsBefore, form]
    .join('\n')
    .replace(/(href|src)="\/\//g, '$1="https://');

  return resolved;
}
