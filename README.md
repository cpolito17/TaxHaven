# Tax Haven

A browser game where you're crowned ruler of the United States, redesign the
federal **income-tax system** and the **federal budget** however you like, then
press **Simulate** to find out what your choices did to the country. It's a game
first, but doubles as an educational tool — every outcome is explained in a
post-term *"What happened & why"* panel.

Runs **entirely in the browser**: all data, logic, and simulation are baked in.
Zero network calls, works offline, desktop-first.

## Play

- **Hosted:** https://charliepolito.com/taxhaven
- **Local:** open `public/index.html` in a browser, or serve it:
  ```bash
  cd public && python3 -m http.server 8777   # → http://localhost:8777
  ```

## How it works

- **Income tab** — bracket editor (≤7 bands, live marginal-vs-average readout),
  payroll, corporate, standard deduction, capital-gains treatment, VAT, tariffs,
  estate tax, filing-status doubling, 5-year rolling-average basis, and cash
  grants. Five presets: Current US, Nordic, 1944, 1965, 1988.
- **Budget tab** — free sliders for every category; **net interest** is forced on
  you and grows with the debt (the "nothing is free" spine). Optional rainy-day
  stabilization fund.
- **Four meters** — Economy, Approval, Treasury, Equality (0–100), each with a
  real supporting figure. Revenue elasticity (Laffer), regressivity, public
  investment, deficits, and shocks all move them in directionally-honest ways.
- **Events** — policy backfires (threshold-gated), exogenous shocks (luck,
  softened by resilience), and rare approval-gated catastrophes.

Baseline calibrated to approximate **US FY2024** federal actuals. It's a teaching
toy — directionally honest, not a macroeconomic forecast.

## Repo layout

```
public/index.html   built, self-contained game (the deployed artifact)
src/                game source — assembled into public/index.html
  head.html         markup + CSS
  engine.js         simulation engine (also node-testable)
  ui.js             UI / interaction layer
  build.sh          concatenates the parts → public/index.html
worker/index.js     Cloudflare Worker that serves the game at /taxhaven
wrangler.toml       Worker + static-assets + route config
MANDATE-spec.md     original design spec
```

## Build

The deployed file is generated from `src/`:

```bash
bash src/build.sh    # writes public/index.html
```

## Deploy (Cloudflare Worker → charliepolito.com/taxhaven)

```bash
npx wrangler login          # one-time, authorizes your Cloudflare account
npx wrangler deploy         # publishes the worker + assets to the route
```

The route `charliepolito.com/taxhaven*` requires the `charliepolito.com` zone to
be on the same Cloudflare account. The Worker takes precedence over the existing
site for that path prefix; the rest of the domain is untouched.

`npx wrangler dev` runs it locally for a production-like preview.
