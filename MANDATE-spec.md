# MANDATE — Project Specification

*A browser game where you redesign America's taxes and budget, then live with the consequences.*

> **Working title:** "MANDATE" is a placeholder. See §9 — pick a final name before branding, or keep this one.

---

## How to use this document

This is the build spec for a single-page, fully client-side browser game. It defines the product, the mechanics, the look, and every decision already settled in scoping. It deliberately does **not** prescribe file structure, frameworks, the charting/animation library, or the exact math behind the simulation — those are yours to choose.

Before building: read the whole spec, then ask only the questions that would *materially* change the build (there's a short list of genuinely open items in §9). If nothing is blocking, scope the work and execute it end to end. Don't pause for confirmation on reversible decisions that clearly follow from this spec.

While building: build only what's specified here. Don't add mechanics, settings, abstractions, or "future-proofing" beyond what's described — do the simplest thing that works well and feels good. There's a "v2 — design for, don't build" section (§8); treat it as a list of things *not* to build now. Establish a way to verify the thing actually works as you go — the page loads with no console errors and no network requests, a preset produces sensible numbers, moving a slider updates the pie chart and meters live, and a full three-term run reaches an end screen — and check against that continuously rather than only at the end. Report what you've actually verified versus what you haven't; don't assume success.

---

## 1. What we're building

A single-page browser game in which the player is crowned ruler of the United States and given free rein to **redesign the federal income tax system and the federal budget** however they like — realistic or not — then press **Simulate** to find out what their choices did to the country. The whole thing runs entirely in the browser with **zero network calls**: all data, all logic, all simulation is baked in and works offline.

It's a game first, but it doubles as an **educational tool**. The point is to let anyone — including someone with no tax knowledge — feel the unintended consequences of policy changes that look small. Tax the working poor a little too hard and watch approval collapse into unrest. Soak top earners at 90% and watch revenue *fail to rise* as money flees and shelters. Zero out Social Security and trigger mass revolt. The lessons land because the player chose the lever and watched the chain of effects play out.

**Who it's for:** curious people across the spectrum of tax knowledge — fiscal-policy hobbyists who want a sandbox, and complete novices who learn how the pieces fit by playing. It needs to be approachable enough that a newcomer succeeds on feel, and deep enough that someone who knows the material finds the tradeoffs honest.

**Platform & deployment:** a standalone web page hosted on the author's personal site (charliepolito.com). Self-contained, offline-capable, desktop-first.

**Scope for v1:** the full three-term campaign loop, both editor tabs, the four-meter scoring model, the two-bucket event system, and the end-of-run scorecard — all described below.

---

## 2. The thing that matters most

**Every outcome must be legible.** When the simulation does something to the country, the player must be able to see *why* — which lever they pulled, what it set in motion, and how it moved the meters. The single feature this whole project is judged against is the post-term **"What happened & why"** explanation (§5.5): the moment a player goes "ohhh, *that's* why." If outcomes feel arbitrary or black-box, the game has failed at its core job, no matter how polished everything else is.

The bar, stated as a test: a curious person with zero tax knowledge should finish a run understanding at least one real policy tradeoff they didn't understand before — and never once feel lectured. When a trade-off arises in the build, resolve it toward **causal clarity and low friction**, not toward simulation realism for its own sake. This is a teaching toy with a game's soul, not an economic model with a UI.

It must also simply feel good to play: snappy sliders, a living pie chart, smooth event pop-ups. "Educational" must never read as "homework."

---

## 3. Decisions already made

These are settled. They answer the most likely questions up front; don't re-open them.

**Shape of the game**
- **Multi-term campaign, not a one-shot and not a civilization sim.** The focus stays narrowly on income-tax design and the federal budget. World events touch *some* of the numbers; they never expand the game into governing armies, diplomacy trees, etc.
- **Three terms, four years each, twelve years total, hard cap.** Each press of **Simulate** advances one full term. Between terms the player freely reconfigures everything — this is the roguelike checkpoint rhythm: tune, simulate a term, see results and events, re-tune, continue.
- **The run is quittable at any point** without feeling like much was lost — the scorecard is always reachable. The campaign is short by design (a few minutes) and meant to be **replayable**.
- **Low approval does not end the run directly.** Instead, very low approval raises the probability of rare, run-ending catastrophes (§5.4). A struggling government stays playable but lives dangerously.

**The deficit is the spine connecting the two tabs**
- **Balance = total Revenue − total Spending**, shown as a green **Surplus** or red **Deficit**.
- A deficit adds to national **debt**; debt accrues interest; and **net interest becomes a budget line item the player cannot slide** — it's forced on them and grows as debt grows. This feedback loop is the central "nothing is free" lesson and must be present in v1.

**Income tab — what's configurable** (the editable levers)
- **Bracket editor:** add, remove, and drag tax bands; set each band's income threshold and marginal rate; a live readout of the resulting *average* (effective) rate at a few sample incomes so the marginal-vs-average distinction is visible. Cap at ~7 bands so the editor and pie labels stay readable.
- **Payroll tax** (Social Security + Medicare) — included deliberately; it's a huge, regressive, frequently-forgotten share of federal revenue and one of the best teaching levers.
- **Corporate income tax rate.**
- **Standard deduction / zero-rate threshold** (the "exempt the bottom" lever).
- **Capital gains treatment:** a mode toggle (taxed at ordinary rates / preferential flat rate / custom), plus two sub-toggles — **eliminate stepped-up basis at death** and **index basis to inflation**.
- **VAT / national sales tax** (a broad, efficient, regressive lever).
- **Tariffs.**
- **Filing-status doubling** (the married-couples-file-jointly band-doubling behavior, as a toggle).
- **Estate / wealth tax** (toggle + rate).
- **Five-year rolling-average income basis** (toggle) — see §6 for its in-game effect.
- **Grants, paid as visible year-end cash rather than buried credits:** child grant, first-time-homeownership grant, and a charitable match (government returns a set fraction per dollar donated).
- **Presets:** **Current US**, **Nordic-style**, and **US Historical** for a few interesting eras of the American tax code. Presets load a complete configuration the player can then tweak — this is the main on-ramp for novices and the main comparison tool. (Pick the historical eras yourself from genuinely distinct, instructive points in US tax history; confirm the set in §9 if you want a steer.)

**Budget tab — what's configurable**
- **Free sliders for every spending category, including unrealistic settings.** The player *can* zero out Social Security or send Defense to the moon. The friction comes from consequences and the meters, **not** from locking the controls — this keeps it a sandbox, not a form.
- Real federal categories (Social Security, Medicare, Medicaid & other health, Defense, income-security / safety net, Veterans, Education, Transportation & infrastructure, Science, International affairs, and a catch-all).
- **Net interest** appears as a category but is **not slidable** — it's computed from accumulated debt (the spine, above).
- **Revenue stabilization fund:** a toggle plus a "share of surplus to divert" slider — see §6 for its in-game effect.

**Scoring — four national meters**
- **Economy, Approval, Treasury, Equality.** Each is a 0–100 index shown as a bar, with a real supporting figure surfaced on hover/expand (Economy → GDP growth; Approval → the approval percentage; Treasury → deficit and debt-to-GDP; Equality → an inequality measure). The **Current US** preset is calibrated so each meter sits mid-range, leaving room to both improve and wreck things.
- **Success** means ending the campaign with a high standard of living, an affordable tax burden on the *median* household, and a treasury that isn't drowning in debt — expressed as a composite score and letter grade on the end screen.

**Randomness**
- **Threshold-gated.** A configuration kept inside safe ranges never triggers a self-inflicted (policy) event. Cross a danger line and you *risk* one, with probability scaling by how far over you are. Bad luck (exogenous shocks) can still strike a good government, but a robust one weathers it. No single event swing is allowed to be run-ruining on its own (cap per-event effects to a modest single-term magnitude); only the rare catastrophes end runs.

**Other settled defaults**
- **Onboarding:** a short, dismissible "How to play" card on first load; no forced tutorial. The hover blurbs carry the ongoing teaching load.
- **Every slider/lever has a hover blurb with a consistent four-part shape:** what it is / what breaks if you set it too high / what breaks if you set it too low / a real-world anchor.
- **Best-score persistence** (local to the browser) is fine in v1 to support the "beat your best" replay hook. A shared/online leaderboard is **v2** (§8).
- **Desktop-first**, single self-contained page, no accounts, no backend, no network calls of any kind.

---

## 4. Layout

A single-page dashboard. The structure, top to bottom:

**Persistent status bar (always visible, above the tabs).** This is national state, not per-tab, so the player never loses sight of it and never has to switch tabs just to *check* the other side — only to *edit* it. It shows:
- The **four meters** (Economy, Approval, Treasury, Equality) as labeled bars, each with its real figure on hover.
- **Total Revenue, Total Spending, and Balance** (Surplus/Deficit), so each tab carries a high-level summary of the other at all times. Keep this summary genuinely high-level — a few headline numbers, not a second control panel — so it never overloads.
- The **term / year counter** (e.g. "Term 1 · Year 1–4 of 12").

**Tab switch.** Two tabs: **Income** and **Budget**. The two are visually distinguished by accent color (Income cool/teal, Budget warm/peach — see §7) so the player always knows which side of the ledger they're on.

**Tab body.** The focal point of each tab is a large **pie chart, centered near the top of the page** — for Income it shows the proportion of revenue coming from each source; for Budget it shows the proportion of spending going to each category. Below the chart sit the sliders and editors for that tab. The pie updates live as the player drags.

**Action zone (bottom, persistent).** The running **Balance (Revenue − Spending)** displayed prominently directly above the **Simulate** button, so the consequence of the current configuration is the last thing the player sees before committing to a term.

---

## 5. Features & game flow

### 5.1 The term loop

1. Player configures the Income and Budget tabs (or loads a preset and tweaks).
2. Pie charts, meters, Revenue/Spending/Balance update **live** while editing — this is a continuous-feedback sandbox; the player should be able to learn a lot before ever pressing Simulate.
3. Player presses **Simulate** to commit the current configuration as policy for the term.
4. The simulation advances four years: the economy responds and compounds, revenue is realized, the balance feeds the debt, debt accrues interest, the stabilization fund fills or draws, and the four meters move.
5. **Events resolve** and surface as animated pop-ups (§5.3–5.4).
6. The **"What happened & why"** panel explains the term's outcome (§5.5).
7. Back to step 1 for the next term — until the third term ends or a catastrophe ends the run early.
8. The run finishes on the **end screen / scorecard** (§5.6).

### 5.2 The two innovation mechanics (make them matter)

These two levers are central to the original design and must have a *felt* gameplay effect, not be dead toggles. Both work primarily by blunting bad-luck shocks, so the careful player who enables them visibly survives storms that wreck the reckless one:

- **Five-year rolling-average income basis (Income tab toggle).** When on, brackets are applied to a smoothed, trailing income base. In-game effect: it **dampens how violently exogenous shocks move revenue** (booms and recessions hit the Treasury more softly). The honest tradeoff, which is also the lesson: a tax change the player enacts takes a term to fully bite, so they can't instantly yank revenue up or down.
- **Revenue stabilization fund (Budget tab toggle + "share of surplus to divert" slider).** Surpluses automatically feed the fund; when a downturn shock lands, the fund automatically draws down to cushion the Treasury and approval hit. The tradeoff: money parked in the fund isn't buying services now, so over-saving carries an opportunity cost.

### 5.3 Events — two buckets

Events surface as **pop-ups with a smooth entrance/exit animation**, clearly themed to the event palette (§7). Keep the writing punchy and plain-language; each pop-up names what happened, why, and the effect on the meters.

- **Policy-triggered events — "your fault," threshold-gated.** Fire only when the player's configuration crosses a danger threshold; probability scales with how far over the line they are. These are the teaching events — they only happen when the meters were already warning. Examples to implement (use judgment on the exact roster and triggers): **Revolt** (taxing low/below-median earners too hard, or gutting the safety net), **Capital Flight** and **Brain Drain** (top rates / capital taxes pushed past the point of diminishing returns), **Sanctions** (defense or tariffs pushed to a provocative extreme), **Debt Downgrade** (deficits/debt-to-GDP run too hot).
- **Exogenous shocks — "bad luck."** Strike regardless of how good the configuration is — the sprinkle of chance. Examples: **Recession**, **Boom**, **Pandemic**, **Oil shock**, **Tech boom**. *How hard* they land depends on the country's resilience: a healthy stabilization fund, low debt-to-GDP, and a diversified revenue mix all soften the blow (tying back to §5.2). This is where robustness gets rewarded.

No single policy event or shock may be run-ending on its own; cap each one's effect to a modest single-term magnitude (a few percent of GDP, ~5–20 approval points). Optionally provide a deterministic/seeded mode so a player can reproduce a run, but the default is live randomness.

### 5.4 Run-ending catastrophes (rare tail risk)

A small set of catastrophic events can end a run before its third term: **Assassination, Coup, Nuclear War**. These are **always rare** — never deterministic, never a scripted punishment. Their probability sits near zero and **rises as approval falls below danger thresholds**, so a low-approval run stays playable but is gambling with the nation's survival. Getting couped should feel like bad luck stacked on bad governing, not a rule. When one fires, the player still drops to their scorecard (§5.6) — the run ends, but the playthrough is never wasted.

### 5.5 "What happened & why" panel (the heart — v1, not polish)

After each term resolves, a short panel walks the **causal chain** in plain language, connecting the player's specific choices to the meter movements. The tone is a knowledgeable narrator, not a textbook. Example of the *kind* of explanation it produces: *"Approval fell 18 points: you taxed households earning below the median at 30%, which at today's cost of living is untenable; consumption dropped and GDP slipped about 2%."* Every meaningful meter change in a term should be traceable to a cause here. This panel is the single most important screen in the game (§2) — give it real care.

### 5.6 End screen / scorecard

When the campaign ends (third term completed, or a catastrophe), show a results screen with:
- A composite **Nation Score** and a **letter grade**.
- The **four final meters**.
- A one-line **"legacy" verdict** capturing the run's character (e.g. a beloved but broke populist; a feared austerity hawk).
- A few **headline stats**: final debt-to-GDP, the median household's effective tax rate under the player's system, and the change in GDP per capita over the twelve years.
- A **replay hook** — "beat your best" — comparing against the locally-stored best score.

### 5.7 Onboarding & tooltips

- **First load:** a dismissible "How to play" card. No mandatory tutorial.
- **Hover blurbs everywhere:** every slider, toggle, and editor control shows a blurb on hover following the fixed four-part shape — *what it is / what breaks if set too high / what breaks if set too low / a real-world anchor.* These are the persistent teaching layer; write them to be genuinely informative and lightly opinionated, never dry.

---

## 6. Simulation logic (principles, not formulas)

Design the actual numbers yourself. What matters is that the causal relationships below hold true and stay legible — they're the substance behind the "what happened & why" panel. Keep the model transparent and tunable rather than realistic; the goal is *directionally honest lessons*, not a credible macroeconomic forecast.

**Revenue behaves with elasticity, not arithmetic.** Taxes don't raise revenue linearly with rate. Low-earner taxes are inelastic (people can't avoid them) but politically explosive. Top-earner and capital taxes are elastic: beyond a point, raising rates yields *less* additional revenue as income shelters, avoids, or leaves — a Laffer-style curve. This diminishing return is the most important single lesson in the game and must be felt when a player cranks the top bracket toward extremes.

**Different revenue sources hit different people.** Payroll, VAT/sales, and tariffs are regressive — efficient at raising money but costly to Equality and to the approval of lower earners (and tariffs feed consumer prices and a possible retaliation shock). Progressive income brackets and the grants/safety net push the other way. The corporate rate interacts with the top individual rate: set far below it and you open an incorporation-arbitrage incentive; set far above it and you blunt investment and competitiveness.

**Spending buys different things.** Social Security, Medicare, and the safety net directly support Approval and Equality; cutting them hard risks Revolt. Defense too low invites a security shock; too high invites Sanctions, plus pure opportunity cost and debt. Infrastructure, education, and science are investments that lift *future* Economy on a slower horizon. Net interest is forced and crowds out everything else as debt grows.

**The four meters, in spirit:**
- **Economy** rises with household consumption (driven by the disposable income of low/middle earners), private investment (sensitive to capital and corporate taxes), and public investment (infrastructure/education/science); it's dragged down by instability and by large deficits crowding out the economy.
- **Approval** tracks the tax burden on the median and below-median household, the level of services people rely on, inequality, and recent shocks.
- **Treasury** reflects the balance and debt-to-GDP; persistent large deficits degrade it and eventually trigger a downgrade.
- **Equality** reflects the net progressivity of the whole system — progressive brackets, grants, and safety-net spending against regressive payroll/VAT/tariffs and the treatment of capital.

**Time compounds.** Each Simulate advances four years: Economy compounds, debt accrues interest, the rolling-average basis smooths revenue response across terms, and the stabilization fund accumulates or draws. Catastrophe probability is rolled once per term, near-zero by default and rising as approval sinks.

**Ground the starting state in reality.** Calibrate the initial budget, the revenue mix, and the meter midpoints to real, recent US federal figures (most-recent-available fiscal-year actuals — receipts by source, outlays by category, debt-to-GDP) so the **Current US** preset feels true. Bake these constants in; do not fetch them at runtime. Cite the vintage of the figures somewhere unobtrusive (e.g. an "about the data" note) so it's clear what year the baseline reflects.

---

## 7. UI / UX & design system

**Feel:** clean, modern, calm dashboard. Confident and approachable, not severe or bureaucratic. The pie charts are the unmistakable hero of each tab. Sliders feel snappy and tactile — responsive thumbs, smooth fills, satisfying to drag. Motion is intentional and lightweight: live chart/meter transitions while editing, and smooth event pop-ups that feel like a moment without being slow.

**Color palette** (use varying shades/tints of these — the values are the anchors, not the whole system):
- **Background:** `#EDF6F9` (pale cyan)
- **Main navigation / status bars:** `#006D77` (deep teal)
- **Income section accent:** `#83C5BE` (soft teal-green)
- **Budget section accent:** `#FFC7B4` (warm peach)
- **Events:** `#E29578` (terracotta) — pop-ups and event styling
- Derive shades and tints from these for hovers, fills, borders, danger states, and depth. Keep contrast and readability strong throughout.

**Income vs Budget distinction:** the two tabs share one layout but are color-coded — Income leans on the cool teal accent, Budget on the warm peach accent — so the player always knows which side of the ledger they're editing. The four meters should each have a fixed, consistent color so they're recognizable at a glance across both tabs.

**Danger-aware sliders:** color-code each slider's track/fill to communicate how close the current setting is to a danger threshold (e.g. a calm-to-hot gradient, or a green→amber→red zone treatment). The player should be able to see "I'm getting close to the edge" without reading a number. This is the visual half of the threshold-gated event system.

**Pie charts:** clean, modern, clearly labeled, with smooth transitions as proportions change. Legible category/source labels and values; readable at the ~7-band/category maximum.

**Typography & components:** pick a clean, modern, readable type system and a consistent component language (cards, toggles, chips, modal pop-ups) that fits the calm-dashboard feel. Tooltips/blurbs should be easy to read and quick to appear.

Library choices (charting, animation, component styling) are yours — anything that runs fully client-side with no network dependency at runtime is fine. Bundle assets locally; the page must work offline.

---

## 8. Out of scope / v2 — design for, don't build

Leave room for these but **do not build them now**. The architecture shouldn't preclude them; that's all.

- **Online / shared leaderboard.** Best-score persistence is local-only in v1. A networked leaderboard (the only feature that would need a backend or external storage) is v2.
- **Challenge scenarios** — preset starting conditions chosen *before* a run begins (e.g. "start mid-recession," "fund universal healthcare without going broke"). A clean v2 addition for replayability; keep the run-setup flow able to accommodate a scenario choice later, but ship v1 with the standard start only.
- **Saving/resuming an in-progress campaign** and **shareable run links.**
- **Mobile-optimized layout.** Desktop-first now; don't dig a hole that makes a future responsive pass painful, but don't spend v1 effort chasing it.

---

## 9. Anything to confirm before starting

1. **Game name.** "MANDATE" is a working placeholder chosen for the re-election/approval theme. Use it throughout unless the author supplies a final name. (If a steer helps: alternatives floated include "Ways & Means" and "The Treasury.")
2. **US Historical presets.** v1 ships **Current US** and **Nordic-style** plus a few **US Historical** eras. Choose genuinely distinct, instructive eras of the US tax code yourself unless the author specifies which ones — confirm the set if you'd like direction before wiring the presets.
3. **Baseline data vintage.** Use the most-recent-available US federal fiscal-year actuals for the starting budget, revenue mix, and meter calibration, baked in as constants. Flag the specific year you used.

Nothing else should block you. Read the spec, raise only materially-blocking questions, then scope and build the full v1 end to end, verifying against a real playthrough as you go.
