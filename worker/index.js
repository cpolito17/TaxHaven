/**
 * Tax Haven — Cloudflare Worker
 *
 * Serves the single-file game at charliepolito.com/taxhaven (and /taxhaven/...).
 * Static assets live in ./public and are exposed through the ASSETS binding.
 * We strip the /taxhaven path prefix so the bundled index.html resolves at the
 * sub-path, then hand the request to the assets binding.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Strip the "/taxhaven" mount point, leaving the asset-relative path.
    let path = url.pathname.replace(/^\/taxhaven/, '');
    if (path === '' || path === '/') path = '/index.html';

    const assetUrl = new URL(path, url.origin);
    const res = await env.ASSETS.fetch(new Request(assetUrl, request));

    // The game is fully self-contained; allow long caching of the one asset.
    const headers = new Headers(res.headers);
    if (res.ok && path.endsWith('.html')) {
      headers.set('Cache-Control', 'public, max-age=3600');
    }
    return new Response(res.body, { status: res.status, headers });
  }
};
