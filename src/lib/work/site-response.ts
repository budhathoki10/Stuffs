import "server-only";

/**
 * Client sites are static HTML with no scripts, so they're served with a CSP that
 * forbids scripts outright. Anything a freelancer types is escaped by the renderer;
 * this is the second lock on the door.
 */
const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data: https:",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");

export function htmlResponse(html: string, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(html, {
    status: init.status ?? 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      ...init.headers,
    },
  });
}

export function simplePage(title: string, text: string, back?: string) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 20px;color:#222}a{color:inherit}</style></head>
<body><h1 style="font-size:1.4rem">${esc(title)}</h1><p>${esc(text)}</p>${back ? `<p><a href="${esc(back)}">Go back</a></p>` : ""}</body></html>`;
}
