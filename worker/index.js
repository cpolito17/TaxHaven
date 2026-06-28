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
    const origin = new URL(request.url).origin;
    return env.ASSETS.fetch(new Request(origin + '/index.html', request));
  }
};
