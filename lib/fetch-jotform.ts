import vm from 'node:vm';

/**
 * Jotform's JS Embed endpoint at `https://form.jotform.com/jsform/<FORM_ID>`
 * returns JavaScript that calls `document.write(...)` to inject the form's
 * HTML into the host page. We can't run that in React (`document.write`
 * after page load would wipe the document), so we execute the script
 * server-side in a `vm` sandbox, capture every write into a string, and
 * hand the resulting HTML to a client component which injects it via
 * `dangerouslySetInnerHTML`.
 *
 * The result is a *same-origin* form: we own the DOM, so we can find the
 * `polyguard_jwt` input, set its value once the Trust Check passes, and
 * submit the form — no cross-origin postMessage, no Custom Code paste
 * inside Jotform.
 *
 * Returns the assembled HTML on success. Returns `null` if Jotform serves
 * its missing-form fallback (which means the form ID is wrong / unpublished).
 * Throws on network errors so the page can render a clear error state.
 */
export async function fetchJotformHtml(formId: string): Promise<string | null> {
  const url = `https://form.jotform.com/jsform/${encodeURIComponent(formId)}`;
  const res = await fetch(url, {
    headers: {
      // Jotform serves a stripped response to unknown UAs.
      'User-Agent':
        'Mozilla/5.0 (compatible; demo-workforce-applications/1.0; +https://github.com/polyguard-ai/demo-workforce-applications)',
    },
    // Cache for an hour; the form's structure doesn't change minute-to-minute.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Jotform jsform endpoint returned ${res.status}`);
  }
  const script = await res.text();

  if (script.includes('missing-form')) {
    // Jotform's fallback when the form ID is unknown or unpublished.
    return null;
  }

  // Run the script with a mocked document/window. The only API we care
  // about is `document.write` / `document.writeln`; everything else is a
  // no-op so the script can't crash the request.
  let html = '';
  const noop = () => {};
  const docProxy: ProxyHandler<object> = {
    get(_, key) {
      if (key === 'write' || key === 'writeln') {
        return (s: unknown) => {
          html += String(s ?? '');
        };
      }
      return noop;
    },
  };
  const sandbox: Record<string, unknown> = {};
  sandbox.document = new Proxy({}, docProxy);
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.navigator = { userAgent: 'mock' };
  sandbox.location = { href: 'about:blank', host: '', protocol: 'https:' };

  try {
    vm.createContext(sandbox);
    vm.runInContext(script, sandbox, { timeout: 5000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to evaluate Jotform jsform script: ${msg}`);
  }

  return html || null;
}
