/**
 * Tax Haven — Cloudflare Worker
 *
 * Serves the single-file game at charliepolito.com/taxhaven (and any sub-path).
 * The game is one fully self-contained index.html with no other assets, so the
 * Worker always returns that one file from the ASSETS binding. With
 * html_handling = "none" (see wrangler.toml) the asset router serves
 * /index.html directly — no trailing-slash/canonicalization redirects.
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const url = new URL(request.url);
    const prefix = '/taxhaven';
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) {
      return new Response('Not Found', { status: 404 });
    }

    const assetPath = url.pathname.slice(prefix.length) || '/index.html';
    const assetUrl = new URL(assetPath === '/' ? '/index.html' : assetPath, url.origin);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    const headers = new Headers(assetResponse.headers);
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
  }
};
