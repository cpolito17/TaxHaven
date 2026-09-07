# Tax Haven

Tax Haven is a free, browser-based US tax and federal budget simulator. Rewrite the income-tax code, change spending priorities, and simulate three four-year terms to see how those choices affect economic growth, public approval, federal debt, and equality.

**Play it:** [charliepolito.com/taxhaven](https://charliepolito.com/taxhaven)

**Portfolio:** [charliepolito.com](https://charliepolito.com/)

**Source:** [github.com/cpolito17/TaxHaven](https://github.com/cpolito17/TaxHaven)

## What you can change

- Build up to seven income-tax brackets and compare household tax burdens.
- Adjust payroll, corporate, capital-gains, VAT, tariff, and estate taxes.
- Set spending across Social Security, health, defense, education, infrastructure, science, and other programs.
- Test historical and international policy presets.
- Simulate 12 years of policy effects, shocks, debt service, and political consequences.
- Review an end-of-term explanation and final scorecard.

The model is calibrated to approximate US fiscal year 2024 federal totals. It is an educational game with directionally realistic relationships, not financial advice or a macroeconomic forecast.

## Privacy and security

Tax Haven runs locally in the browser and makes no application network requests. It does not use accounts, analytics, cookies, or a backend database. The only saved data is the player's best score and onboarding preference in browser local storage.

The Cloudflare Worker restricts requests to the published `/taxhaven` route, allows only `GET` and `HEAD`, and adds browser security headers. The application contains no API keys or user-submitted server data.

## Run locally

No dependencies are required. Serve the `public` directory with any static web server:

```bash
python3 -m http.server 8777 --directory public
```

Then open [http://localhost:8777](http://localhost:8777).

## Development

The editable source is split into three files and assembled into one deployment page:

```text
src/head.html       HTML and CSS
src/engine.js       simulation model (usable from Node.js)
src/ui.js           browser interaction layer
src/build.sh        build script
public/index.html   generated deployment artifact
worker/index.js     Cloudflare routing and security headers
wrangler.toml       Worker, assets, and custom-domain route
MANDATE-spec.md     original product specification
```

Build the deployed page:

```bash
bash src/build.sh
```

Run a Cloudflare development preview:

```bash
npx wrangler dev
```

Deploy to the configured custom-domain route:

```bash
npx wrangler deploy
```

## Technical notes

- Vanilla HTML, CSS, and JavaScript
- Fully client-side simulation
- Responsive, keyboard-accessible controls
- Cloudflare Workers static assets
- SEO metadata, canonical URL, structured data, and social sharing metadata

## License

No license has been granted. Copyright © Charlie Polito. See the repository owner before reusing the source.
