/* ============================================================================
   TAX HAVEN — Simulation Engine
   Pure logic, no DOM. Works in node (module.exports) and browser (window.TH).
   All money in trillions of USD unless noted. Baseline ≈ US FY2024 actuals.
   ========================================================================== */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 0. World constants (baked-in, FY2024 actuals — approximate)
  // ---------------------------------------------------------------------------
  const HH = 131e6;            // US households
  const KIDS = 73e6;           // US children
  const GDP0 = 29.0;           // nominal GDP, trillions
  const DEBT0 = 28.2;          // debt held by public, trillions
  const INTEREST_BASE = 0.031; // effective interest rate on debt (→ ~0.87T net interest)
  const BASE_GROWTH = 0.021;   // baseline real-ish GDP growth

  // Actual receipts by source (trillions). Model response scales these.
  const ACTUAL_REV = {
    individual: 2.43,  // individual income tax (incl. capital gains)
    payroll: 1.71,     // social insurance / payroll
    corporate: 0.53,
    tariffs: 0.077,
    estate: 0.034,
    other: 0.27        // excise + misc (fixed-ish)
  };

  // Actual outlays by category (trillions). netInterest computed separately.
  const ACTUAL_SPEND = {
    socialSecurity: 1.46,
    medicare: 0.85,
    health: 0.91,       // Medicaid + other health
    defense: 0.87,
    incomeSecurity: 0.67,
    veterans: 0.32,
    education: 0.27,
    transportation: 0.13,
    science: 0.04,
    international: 0.06,
    other: 0.30
  };

  // Spending categories metadata (for UI + sim grouping)
  const SPEND_CATS = [
    { key: 'socialSecurity', label: 'Social Security', kind: 'safety' },
    { key: 'medicare',       label: 'Medicare',         kind: 'safety' },
    { key: 'health',         label: 'Medicaid & Health',kind: 'safety' },
    { key: 'defense',        label: 'Defense',          kind: 'defense' },
    { key: 'incomeSecurity', label: 'Income Security',  kind: 'safety' },
    { key: 'veterans',       label: 'Veterans',         kind: 'safety' },
    { key: 'education',      label: 'Education',         kind: 'invest' },
    { key: 'transportation', label: 'Transportation',   kind: 'invest' },
    { key: 'science',        label: 'Science',          kind: 'invest' },
    { key: 'international',   label: 'International',     kind: 'other' },
    { key: 'other',          label: 'Everything Else',  kind: 'other' }
  ];

  // Representative households spanning the income distribution.
  // pop sums to 1. capitalShare = fraction of income from capital gains/dividends.
  // eti = elasticity of taxable income (avoidance/flight responsiveness).
  const SEGMENTS = [
    { key:'poor',     label:'Working poor', income:20000,   pop:0.20,  capitalShare:0.01, cons:0.98, kids:0.4, wealth:5000,     eti:0.02 },
    { key:'lowermid', label:'Lower middle', income:45000,   pop:0.25,  capitalShare:0.02, cons:0.95, kids:0.6, wealth:40000,    eti:0.05 },
    { key:'middle',   label:'Middle',       income:75000,   pop:0.25,  capitalShare:0.03, cons:0.90, kids:0.7, wealth:150000,   eti:0.10 },
    { key:'uppermid', label:'Upper middle', income:140000,  pop:0.20,  capitalShare:0.06, cons:0.80, kids:0.8, wealth:500000,   eti:0.18 },
    { key:'affluent', label:'Affluent',     income:300000,  pop:0.07,  capitalShare:0.15, cons:0.65, kids:0.7, wealth:1500000,  eti:0.30 },
    { key:'top1',     label:'Top 1%',       income:900000,  pop:0.025, capitalShare:0.35, cons:0.50, kids:0.6, wealth:8000000,  eti:0.45 },
    { key:'top01',    label:'Top 0.1%',     income:5000000, pop:0.005, capitalShare:0.60, cons:0.30, kids:0.5, wealth:60000000, eti:0.65 }
  ];
  const MEDIAN_KEY = 'middle';
  const CAP_ETI_MULT = 1.8;     // capital flees faster than labor income
  const IMPORT_SHARE = 0.15;    // fraction of consumption that is imported (tariff base)

  // ---------------------------------------------------------------------------
  // 1. Default configuration — the "Current US" lever values
  // ---------------------------------------------------------------------------
  function defaultConfig() {
    return {
      // Income tab
      brackets: [
        { threshold: 0,      rate: 0.10 },
        { threshold: 11600,  rate: 0.12 },
        { threshold: 47150,  rate: 0.22 },
        { threshold: 100525, rate: 0.24 },
        { threshold: 191950, rate: 0.32 },
        { threshold: 243725, rate: 0.35 },
        { threshold: 609350, rate: 0.37 }
      ],
      stdDeduction: 14600,
      payrollRate: 0.153,
      payrollCap: 168600,
      corpRate: 0.21,
      capMode: 'preferential',   // 'ordinary' | 'preferential' | 'custom'
      capRate: 0.20,
      steppedUpElim: false,      // eliminate stepped-up basis at death
      indexInflation: false,     // index basis to inflation
      vatRate: 0.0,
      tariffRate: 0.025,
      filingDouble: true,
      estateEnabled: true,
      estateRate: 0.40,
      estateExemption: 13600000,
      rollingAvg: false,
      childGrant: 0,             // $ per child / yr
      homeownerGrant: 0,         // $ per first-time buyer (annualized cohort)
      charityMatch: 0,           // gov't match fraction per $ donated
      // Budget tab (trillions)
      spend: {
        socialSecurity: 1.46, medicare: 0.85, health: 0.91, defense: 0.87,
        incomeSecurity: 0.67, veterans: 0.32, education: 0.27,
        transportation: 0.13, science: 0.04, international: 0.06, other: 0.30
      },
      stabFund: false,
      surplusShare: 0.25
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Tax math helpers
  // ---------------------------------------------------------------------------
  function bracketTax(taxable, brackets, widthFactor) {
    if (taxable <= 0) return 0;
    let tax = 0;
    for (let i = 0; i < brackets.length; i++) {
      const lo = brackets[i].threshold * widthFactor;
      const hi = (i + 1 < brackets.length ? brackets[i + 1].threshold * widthFactor : Infinity);
      if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * brackets[i].rate;
    }
    return tax;
  }
  function marginalRate(taxable, brackets, widthFactor) {
    let r = 0;
    for (const b of brackets) { if (taxable >= b.threshold * widthFactor) r = b.rate; }
    return r;
  }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // Effective capital-gains rate given mode
  function effCapRate(cfg, ordinaryMarginal) {
    if (cfg.capMode === 'ordinary') return ordinaryMarginal;
    return cfg.capRate; // preferential & custom both use capRate
  }

  // ---------------------------------------------------------------------------
  // 3. Raw model: compute per-segment taxes & aggregate raw figures (unscaled)
  // ---------------------------------------------------------------------------
  function computeRaw(cfg) {
    const widthFactor = cfg.filingDouble ? 1.8 : 1.0;
    const baseWidth = 1.8; // baseline marginal reference uses default (married) widths

    let aggIncomeTax = 0, aggPayroll = 0, aggCorpBaseShift = 0;
    let aggVatBase = 0, aggTariffBase = 0, aggEstate = 0, aggGrants = 0;
    let aggConsumption = 0, aggDispBottom = 0, aggDispBottomBase = 0;
    const segOut = {};

    for (const s of SEGMENTS) {
      const ord0 = s.income * (1 - s.capitalShare);
      const cap0 = s.income * s.capitalShare;

      // Marginal rates faced (current vs baseline default) drive elasticity.
      const ordTaxableGuess = Math.max(0, ord0 - cfg.stdDeduction);
      const ordMarg = marginalRate(ordTaxableGuess, cfg.brackets, widthFactor);
      const baseMarg = marginalRate(Math.max(0, ord0 - 14600), defaultConfig().brackets, baseWidth);
      const capRate = effCapRate(cfg, ordMarg);
      const capRate0 = 0.20;

      // Behavioural response: reported income shrinks as net-of-tax rate falls.
      const ordFactor = Math.pow((1 - ordMarg) / (1 - baseMarg), s.eti);
      const capFactor = Math.pow(clamp((1 - capRate) / (1 - capRate0), 0.01, 5), s.eti * CAP_ETI_MULT);

      const ordReported = ord0 * ordFactor;
      let capReported = cap0 * capFactor;
      // Capital sub-toggles adjust the realized/ taxable base.
      if (cfg.steppedUpElim) capReported *= 1.15;     // more gains realized at death
      if (cfg.indexInflation) capReported *= 0.88;    // inflation shielded

      const ordTaxable = Math.max(0, ordReported - cfg.stdDeduction);
      let incomeTax = bracketTax(ordTaxable, cfg.brackets, widthFactor);
      let capTax;
      if (cfg.capMode === 'ordinary') {
        // stack capital on top of ordinary
        const stacked = bracketTax(ordTaxable + capReported, cfg.brackets, widthFactor);
        capTax = Math.max(0, stacked - incomeTax);
      } else {
        capTax = capReported * cfg.capRate;
      }
      const totalIncomeTax = incomeTax + capTax;

      const payroll = cfg.payrollRate * Math.min(ordReported, cfg.payrollCap);

      // Consumption & indirect taxes
      const disposable = Math.max(0, s.income - totalIncomeTax - payroll);
      const consumption = disposable * s.cons;
      const vatPaid = cfg.vatRate * consumption;
      const tariffPaid = cfg.tariffRate * consumption * IMPORT_SHARE;

      // Estate (annualized via ~2% mortality)
      let estate = 0;
      if (cfg.estateEnabled) {
        const taxableEstate = Math.max(0, s.wealth - cfg.estateExemption);
        estate = taxableEstate * cfg.estateRate * 0.02;
      }

      // Grants received
      const donations = s.income * (s.key === 'top01' || s.key === 'top1' ? 0.03 : 0.02);
      const grants = cfg.childGrant * s.kids
                   + (s.key === 'lowermid' || s.key === 'middle' ? cfg.homeownerGrant * 0.05 : 0)
                   + cfg.charityMatch * donations;

      const w = s.pop * HH;
      aggIncomeTax += totalIncomeTax * w;
      aggPayroll += payroll * w;
      aggVatBase += consumption * w;
      aggTariffBase += consumption * IMPORT_SHARE * w;
      aggEstate += estate * w;
      aggGrants += grants * w;
      aggConsumption += consumption * w;
      if (['poor','lowermid','middle','uppermid'].includes(s.key)) {
        aggDispBottom += (disposable + grants) * w;
      }

      segOut[s.key] = {
        label: s.label, income: s.income,
        incomeTax: totalIncomeTax, payroll, vatPaid, tariffPaid, estate,
        grants, disposable,
        effRate: (totalIncomeTax + payroll + vatPaid + tariffPaid + estate - grants) / s.income
      };
    }

    return {
      widthFactor,
      aggIncomeTax: aggIncomeTax / 1e12,
      aggPayroll: aggPayroll / 1e12,
      aggVatBase: aggVatBase / 1e12,
      aggTariffBase: aggTariffBase / 1e12,
      aggEstate: aggEstate / 1e12,
      aggGrants: aggGrants / 1e12,
      aggConsumption: aggConsumption / 1e12,
      aggDispBottom: aggDispBottom / 1e12,
      seg: segOut
    };
  }

  // Precompute the baseline (Current US) raw figures & references.
  const BASE = computeRaw(defaultConfig());
  const BASE_MEDIAN_BURDEN = BASE.seg[MEDIAN_KEY].effRate;
  const BASE_LOW_BURDEN = (BASE.seg.poor.effRate + BASE.seg.lowermid.effRate) / 2;
  const BASE_CONS = BASE.aggConsumption;
  const BASE_DISP = BASE.aggDispBottom;
  const BASE_SAFETY = sumSafety(defaultConfig().spend);
  const BASE_INVEST = defaultConfig().spend.education + defaultConfig().spend.transportation + defaultConfig().spend.science;
  function sumSafety(sp){return sp.socialSecurity+sp.medicare+sp.health+sp.incomeSecurity+sp.veterans;}

  // Baseline equality reference
  const BASE_EQ_RAW = equalityRaw(BASE, defaultConfig(), { gdp: GDP0, grants: 0 });

  // ---------------------------------------------------------------------------
  // 4. Revenue & spending from a config (scaled to actuals via baseline ratios)
  // ---------------------------------------------------------------------------
  function computeBudget(cfg, state) {
    const raw = computeRaw(cfg);
    const gdpScale = state ? state.gdp / GDP0 : 1;

    // Individual income tax: scale actual by model ratio, then by economy size.
    const individual = ACTUAL_REV.individual * (raw.aggIncomeTax / BASE.aggIncomeTax) * gdpScale;
    const payroll = ACTUAL_REV.payroll * (raw.aggPayroll / BASE.aggPayroll) * gdpScale;

    // Corporate: rate move + profit-shifting base erosion + arbitrage with top individual rate.
    const corpRate0 = 0.21;
    const topInd = Math.max(...cfg.brackets.map(b => b.rate));
    const shiftErosion = Math.pow(clamp((1 - cfg.corpRate) / (1 - corpRate0), 0.01, 5), 0.5);
    const arbitrage = 1 + clamp((topInd - cfg.corpRate) - 0.16, 0, 0.4) * 0.6; // income shifts into corp form
    const corporate = ACTUAL_REV.corporate * (cfg.corpRate / corpRate0) * shiftErosion * arbitrage * gdpScale;

    // VAT: absolute (baseline is 0). Broad consumption base.
    const vat = cfg.vatRate * raw.aggVatBase * 0.92 * gdpScale; // 0.92 = compliance/exemptions

    // Tariffs: scale by rate; retaliation shrinks the base at high rates.
    const tariffRate0 = 0.025;
    const retaliation = 1 - clamp((cfg.tariffRate - 0.06) * 1.5, 0, 0.5);
    const tariffs = ACTUAL_REV.tariffs * (cfg.tariffRate / tariffRate0) * retaliation * gdpScale;

    // Estate: scaled by model ratio (handles toggle/rate/exemption).
    const estate = cfg.estateEnabled
      ? ACTUAL_REV.estate * (raw.aggEstate / Math.max(1e-9, BASE.aggEstate)) * gdpScale
      : 0;

    const other = ACTUAL_REV.other * gdpScale;

    const revenueBySource = { individual, payroll, corporate, vat, tariffs, estate, other };
    const grossRevenue = individual + payroll + corporate + vat + tariffs + estate + other;

    // Spending
    const grants = raw.aggGrants * gdpScale;
    const debt = state ? state.debt : DEBT0;
    const dtg = debt / (state ? state.gdp : GDP0);
    // Interest rate carries a risk premium as debt-to-GDP climbs.
    const interestRate = INTEREST_BASE + clamp((dtg - 0.9) * 0.012, 0, 0.05);
    const netInterest = debt * interestRate;

    const spendBySource = {};
    let programSpend = 0;
    for (const c of SPEND_CATS) { spendBySource[c.key] = cfg.spend[c.key]; programSpend += cfg.spend[c.key]; }
    spendBySource.grants = grants;
    spendBySource.netInterest = netInterest;
    const totalSpend = programSpend + grants + netInterest;

    const balance = grossRevenue - totalSpend;

    return {
      raw, revenueBySource, spendBySource,
      grossRevenue, totalSpend, balance,
      netInterest, interestRate, grants, programSpend,
      gdp: state ? state.gdp : GDP0, debt, dtg
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Equality (net progressivity) — raw index, mapped to meter later
  // ---------------------------------------------------------------------------
  function equalityRaw(raw, cfg, b) {
    const top = (raw.seg.top1.effRate + raw.seg.top01.effRate) / 2;
    const bottom = (raw.seg.poor.effRate + raw.seg.lowermid.effRate) / 2;
    let prog = (top - bottom); // progressive tax structure if positive
    // Redistributive spending & transfers compress the distribution strongly.
    const safety = sumSafety(cfg.spend);
    const gdp = b ? b.gdp : GDP0;
    const grantsT = b ? b.grants : 0;
    prog += clamp((safety - BASE_SAFETY) / gdp * 4.5, -0.45, 0.6);
    prog += grantsT / gdp * 5;
    prog += (cfg.childGrant / 4000) * 0.03;
    prog -= cfg.vatRate * 0.22;                         // VAT is regressive (but offset by transfers)
    prog -= clamp(cfg.tariffRate - 0.03, 0, 1) * 0.4;
    if (cfg.capMode === 'preferential' && cfg.capRate < 0.20) prog -= 0.04;
    if (cfg.steppedUpElim) prog += 0.02;
    return prog;
  }

  // ---------------------------------------------------------------------------
  // 6. The simulation — advance one term (4 years)
  // ---------------------------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function initialState() {
    return {
      term: 0, year: 0,
      gdp: GDP0, gdpStart: GDP0, debt: DEBT0,
      economy: 52, approval: 50, treasury: 45, equality: 48,
      fund: 0,
      prevRevenue: null,
      lastShockApproval: 0,
      ended: false, endReason: null,
      history: []
    };
  }

  // Map raw drivers → meter targets (0..100)
  function meterTargets(b, cfg, state) {
    const raw = b.raw;
    const grantsT = b.grants;
    // Economy: growth-based, plus accumulated level relative to trend.
    const consGap = raw.aggConsumption / BASE_CONS - 1;
    const dispGap = raw.aggDispBottom / BASE_DISP - 1;
    const invDrag = (effCapRateAvg(cfg) - 0.20) * 0.06 + (cfg.corpRate - 0.21) * 0.07;
    const pubInvest = (cfg.spend.education + cfg.spend.transportation + cfg.spend.science - BASE_INVEST);
    const deficitDrag = clamp((-b.balance / b.gdp) - 0.05, 0, 1) * 0.12;
    const tariffDrag = clamp(cfg.tariffRate - 0.03, 0, 1) * 0.20;
    const growth = BASE_GROWTH + dispGap * 0.05 + consGap * 0.02 - invDrag + pubInvest * 0.010
                   - deficitDrag - tariffDrag;
    const econ = 52 + (growth - BASE_GROWTH) * 850;

    // Treasury: debt-to-GDP and deficit.
    const deficitPct = -b.balance / b.gdp;
    const treas = 50 - (b.dtg - 0.97) * 42 - (deficitPct - 0.059) * 200 + (state.fund / b.gdp) * 60;

    // Equality
    const eqRaw = equalityRaw(raw, cfg, b);
    const eq = 48 + (eqRaw - BASE_EQ_RAW) * 130;

    // Approval
    const medianBurden = raw.seg[MEDIAN_KEY].effRate;
    const lowBurden = (raw.seg.poor.effRate + raw.seg.lowermid.effRate) / 2;
    const safety = sumSafety(cfg.spend);
    const serviceCut = clamp((BASE_SAFETY - safety) / BASE_SAFETY, -1, 1); // +cut / -expand
    const serviceGap = (safety - BASE_SAFETY + 0.4 * grantsT) / b.gdp;      // share of GDP (+expand/-cut)
    // Burden is felt NET of the services those taxes buy back. Taxing low earners
    // is explosive — unless services/transfers visibly give it back.
    const medianNet = (medianBurden - BASE_MEDIAN_BURDEN) - clamp(serviceGap, 0, 1) * 3.5;
    const lowNet = clamp(lowBurden - BASE_LOW_BURDEN - clamp(serviceGap, 0, 1) * 3.0, 0, 1);
    let appr = 50
      - medianNet * 80
      - lowNet * 210
      + serviceGap * 90
      + (growth - BASE_GROWTH) * 300
      + (eq - 48) * 0.05;

    return {
      economy: clamp(econ, 0, 100),
      treasury: clamp(treas, 0, 100),
      equality: clamp(eq, 0, 100),
      approval: clamp(appr, 0, 100),
      growth, medianBurden, lowBurden, serviceCut, serviceGap, deficitPct
    };
  }
  function effCapRateAvg(cfg) {
    if (cfg.capMode === 'ordinary') return Math.max(...cfg.brackets.map(b => b.rate)) * 0.7;
    return cfg.capRate;
  }

  // ---- Events ---------------------------------------------------------------
  function policyEvents(b, cfg, t, state, rng, log) {
    const events = [];
    const topInd = Math.max(...cfg.brackets.map(x => x.rate));
    const capR = effCapRateAvg(cfg);
    const safety = sumSafety(cfg.spend);
    const serviceCut = (BASE_SAFETY - safety) / BASE_SAFETY;

    const checks = [
      { key:'revolt', name:'Revolt', palette:'danger',
        over: Math.max(t.lowBurden - clamp(t.serviceGap,0,1)*3.0 - 0.32, serviceCut - 0.45, (0.28 - t.approval/100) ),
        k: 0.9,
        effect: { approval:-15, economy:-6, equality:-4 },
        text: 'Households below the median buckled under their tax burden while the safety net thinned. Strikes and protests spread.' },
      { key:'capflight', name:'Capital Flight', palette:'danger',
        over: capR - 0.45,
        k: 1.1,
        effect: { economy:-7, treasury:-4 },
        text: 'Capital taxes pushed past the point of diminishing returns. Money, assets, and reported gains fled offshore — the base shrank faster than rates rose.' },
      { key:'braindrain', name:'Brain Drain', palette:'danger',
        over: topInd - 0.62,
        k: 1.0,
        effect: { economy:-6, treasury:-3 },
        text: 'Top marginal rates climbed so high that high earners and founders relocated. Talent and its tax revenue left with them.' },
      { key:'sanctions', name:'Sanctions & Retaliation', palette:'danger',
        over: Math.max(cfg.tariffRate - 0.10, (cfg.spend.defense - 1.5) * 0.5),
        k: 0.8,
        effect: { economy:-5, approval:-6 },
        text: 'Aggressive tariffs and saber-rattling provoked retaliation. Export markets closed and prices rose.' },
      { key:'downgrade', name:'Debt Downgrade', palette:'danger',
        over: Math.max(b.dtg - 1.25, t.deficitPct - 0.11),
        k: 1.2,
        effect: { treasury:-9, economy:-4 },
        text: 'Deficits and debt-to-GDP ran too hot. Ratings agencies downgraded the nation; borrowing costs jumped, forcing net interest higher.' }
    ];

    for (const c of checks) {
      if (c.over <= 0) continue;
      const p = clamp(c.k * c.over, 0, 0.85);
      if (rng() < p) {
        events.push({ type:'policy', name:c.name, palette:c.palette, text:c.text, effect:c.effect });
        if (c.key === 'downgrade') state.debtPremium = (state.debtPremium||0) + 0.006;
      }
    }
    return events;
  }

  function exogenousShock(b, cfg, state, rng) {
    // Resilience softens negative shocks.
    const fundRatio = clamp(state.fund / (0.10 * b.gdp), 0, 1);
    const debtResil = clamp(1 - (b.dtg - 0.6) , 0, 1);
    const diversity = revenueDiversity(b);
    let resilience = 0.45 * fundRatio + 0.30 * debtResil + 0.25 * diversity;
    if (cfg.rollingAvg) resilience += 0.15;
    resilience = clamp(resilience, 0, 0.9);
    const soft = 1 - resilience;

    const roll = rng();
    if (roll < 0.42) return null; // calm term

    const pool = [
      { key:'recession', name:'Recession', palette:'event', neg:true,
        base:{ economy:-9, approval:-7, treasury:-6 },
        text:'A global recession hit. Demand fell and revenue softened.' },
      { key:'pandemic', name:'Pandemic', palette:'event', neg:true,
        base:{ economy:-8, approval:-6, treasury:-7 },
        text:'A pandemic struck — emergency spending surged and the economy stalled.' },
      { key:'oil', name:'Oil Shock', palette:'event', neg:true,
        base:{ economy:-6, approval:-8 },
        text:'An oil shock spiked prices. Inflation bit household budgets.' },
      { key:'boom', name:'Economic Boom', palette:'good', neg:false,
        base:{ economy:+8, approval:+5, treasury:+5 },
        text:'An unexpected boom lifted incomes and tax receipts.' },
      { key:'tech', name:'Tech Boom', palette:'good', neg:false,
        base:{ economy:+7, treasury:+4, equality:-2 },
        text:'A technology surge boosted growth and capital gains revenue — though the gains pooled at the top.' }
    ];
    const pick = pool[Math.floor(rng() * pool.length)];
    const effect = {};
    let drawFromFund = 0;
    for (const k in pick.base) {
      let v = pick.base[k];
      if (pick.neg && v < 0) {
        v = v * soft;
        if (cfg.rollingAvg && (k === 'treasury')) v *= 0.6; // smoothed base
      }
      effect[k] = Math.round(v * 10) / 10;
    }
    if (pick.neg && state.fund > 0) {
      // fund cushions approval & treasury
      drawFromFund = Math.min(state.fund, 0.04 * b.gdp);
      const cushion = (drawFromFund / (0.04 * b.gdp));
      effect.approval = (effect.approval || 0) + cushion * 4;
      effect.treasury = (effect.treasury || 0) + cushion * 4;
      state.fund -= drawFromFund;
    }
    return { type:'shock', name:pick.name, palette:pick.palette, text:pick.text, effect, drawFromFund, resilience };
  }
  function revenueDiversity(b) {
    const r = b.revenueBySource, tot = b.grossRevenue;
    const shares = [r.individual, r.payroll, r.corporate, r.vat, r.tariffs, r.estate].map(x => x / tot);
    const hhi = shares.reduce((a, s) => a + s * s, 0);
    return clamp((0.5 - hhi) / 0.3, 0, 1); // lower concentration = more diverse
  }

  function catastropheRoll(state, rng) {
    const base = 0.004;
    const extra = state.approval < 35 ? (35 - state.approval) * 0.006 : 0;
    const p = clamp(base + extra, 0, 0.22);
    if (rng() < p) {
      const list = [
        { name:'Assassination', text:'With approval in free-fall, a desperate plot succeeded. The administration ends abruptly.' },
        { name:'Coup', text:'A government this unpopular invited a coup. The military seized control.' },
        { name:'Nuclear War', text:'Instability spiraled into catastrophe. The unthinkable happened.' }
      ];
      return list[Math.floor(rng() * list.length)];
    }
    return null;
  }

  // ---- Advance one term -----------------------------------------------------
  function simulateTerm(state, cfg, seed) {
    const rng = mulberry32((seed ^ (state.term * 0x9e3779b1)) >>> 0);
    const before = { economy:state.economy, approval:state.approval, treasury:state.treasury, equality:state.equality };
    const chain = [];   // causal explanations
    const events = [];

    // Pre-term budget snapshot (for "what changed")
    let b = computeBudget(cfg, state);
    let t = meterTargets(b, cfg, state);

    // Simulate 4 years of compounding economy + debt.
    for (let y = 0; y < 4; y++) {
      b = computeBudget(cfg, state);
      t = meterTargets(b, cfg, state);
      // economy growth compounds
      let g = t.growth;
      state.gdp = state.gdp * (1 + g);
      // balance feeds debt
      state.debt = Math.max(0, state.debt - b.balance);
      // stabilization fund fills on surplus
      if (cfg.stabFund && b.balance > 0) {
        const divert = cfg.surplusShare * b.balance;
        state.fund += divert;
      }
    }
    state.term += 1;
    state.year = state.term * 4;

    // Recompute final post-term budget & targets
    b = computeBudget(cfg, state);
    t = meterTargets(b, cfg, state);

    // Move meters toward targets (some momentum), record causal chain.
    const applyMeter = (key, target, label) => {
      const prev = state[key];
      const moved = prev + (target - prev) * 0.7;
      state[key] = clamp(moved, 0, 100);
    };
    applyMeter('economy', t.economy);
    applyMeter('approval', t.approval);
    applyMeter('treasury', t.treasury);
    applyMeter('equality', t.equality);

    // ---- Events ----
    const pol = policyEvents(b, cfg, t, state, rng, chain);
    const shock = exogenousShock(b, cfg, state, rng);
    const allEvents = pol.concat(shock ? [shock] : []);
    for (const ev of allEvents) {
      for (const k in ev.effect) {
        if (['economy','approval','treasury','equality'].includes(k)) {
          state[k] = clamp(state[k] + ev.effect[k], 0, 100);
        }
      }
      events.push(ev);
    }

    // ---- Catastrophe (per term) ----
    const cat = catastropheRoll(state, rng);
    let catastrophe = null;
    if (cat) { catastrophe = cat; state.ended = true; state.endReason = cat.name; }

    // ---- Build "what happened & why" causal chain ----
    buildChain(chain, before, state, b, t, cfg, allEvents);

    // History snapshot
    state.history.push({
      term: state.term, gdp: state.gdp, debt: state.debt,
      meters: { economy:state.economy, approval:state.approval, treasury:state.treasury, equality:state.equality },
      balance: b.balance
    });

    if (state.term >= 3 && !state.ended) { state.ended = true; state.endReason = 'completed'; }

    return { budget: b, targets: t, events, catastrophe, chain, before, after: {
      economy:state.economy, approval:state.approval, treasury:state.treasury, equality:state.equality } };
  }

  function delta(label, before, after, unit) {
    const d = after - before;
    if (Math.abs(d) < 0.5) return null;
    const dir = d > 0 ? 'rose' : 'fell';
    return { label, d, text: `${label} ${dir} ${Math.abs(d).toFixed(0)}${unit||''}` };
  }

  function buildChain(chain, before, state, b, t, cfg, events) {
    const lines = [];
    const medPct = (t.medianBurden * 100).toFixed(0);
    const lowPct = (t.lowBurden * 100).toFixed(0);

    // Approval
    const dA = state.approval - before.approval;
    if (Math.abs(dA) >= 1) {
      let why = [];
      if (t.medianBurden > BASE_MEDIAN_BURDEN + 0.02) why.push(`the median household now pays about ${medPct}% of income in tax`);
      else if (t.medianBurden < BASE_MEDIAN_BURDEN - 0.02) why.push(`you eased the median household's burden to about ${medPct}%`);
      if (t.lowBurden > BASE_LOW_BURDEN + 0.02) why.push(`low earners are taxed near ${lowPct}% — untenable at today's cost of living`);
      if (t.serviceCut > 0.1) why.push(`cuts to Social Security, Medicare and the safety net left people exposed`);
      else if (t.serviceCut < -0.1) why.push(`expanded services reassured the public`);
      if (t.growth > BASE_GROWTH + 0.005) why.push(`a growing economy lifted the mood`);
      else if (t.growth < BASE_GROWTH - 0.005) why.push(`a slowing economy soured the mood`);
      lines.push({ meter:'approval', d:dA, text:`Approval ${dA>0?'rose':'fell'} ${Math.abs(dA).toFixed(0)} points — ${why.join('; ') || 'small net shifts across your policy mix'}.` });
    }
    // Economy
    const dE = state.economy - before.economy;
    if (Math.abs(dE) >= 1) {
      let why = [];
      if (t.growth > BASE_GROWTH) why.push(`GDP grew about ${(t.growth*100).toFixed(1)}% a year`);
      else why.push(`GDP growth slowed to about ${(t.growth*100).toFixed(1)}% a year`);
      if (effCapRateAvg(cfg) > 0.28) why.push(`high capital and corporate taxes dampened private investment`);
      const pubInv = cfg.spend.education + cfg.spend.transportation + cfg.spend.science;
      if (pubInv > BASE_INVEST + 0.05) why.push(`public investment in infrastructure, education and science is paying off`);
      if (t.deficitPct > 0.08) why.push(`large deficits crowded out the economy`);
      lines.push({ meter:'economy', d:dE, text:`Economy ${dE>0?'rose':'fell'} ${Math.abs(dE).toFixed(0)} — ${why.join('; ')}.` });
    }
    // Treasury
    const dT = state.treasury - before.treasury;
    if (Math.abs(dT) >= 1) {
      const bal = b.balance;
      let why = bal >= 0
        ? `a surplus of $${bal.toFixed(2)}T began paying down debt`
        : `a deficit of $${(-bal).toFixed(2)}T added to the debt`;
      why += `; debt-to-GDP is now ${(b.dtg*100).toFixed(0)}% and net interest costs $${b.netInterest.toFixed(2)}T (a bill you can't cut)`;
      lines.push({ meter:'treasury', d:dT, text:`Treasury ${dT>0?'rose':'fell'} ${Math.abs(dT).toFixed(0)} — ${why}.` });
    }
    // Equality
    const dQ = state.equality - before.equality;
    if (Math.abs(dQ) >= 1) {
      let why = [];
      if (cfg.vatRate > 0.02) why.push(`a broad VAT raised money but hit lower earners hardest`);
      if (cfg.payrollRate > 0.16) why.push(`heavy payroll taxes fell hardest below the wage cap`);
      if (cfg.capMode === 'preferential' && cfg.capRate < 0.2) why.push(`a low capital-gains rate favored top earners`);
      if (sumSafety(cfg.spend) > BASE_SAFETY) why.push(`expanded safety-net spending narrowed the gap`);
      if (cfg.childGrant > 0) why.push(`child grants put cash in lower-income hands`);
      lines.push({ meter:'equality', d:dQ, text:`Equality ${dQ>0?'rose':'fell'} ${Math.abs(dQ).toFixed(0)} — ${why.join('; ') || 'shifts in the balance of progressive and regressive taxes'}.` });
    }
    // Event lines
    for (const ev of events) {
      lines.push({ meter:'event', text:`${ev.name}: ${ev.text}` });
    }
    for (const l of lines) chain.push(l);
  }

  // ---------------------------------------------------------------------------
  // 7. Scoring / scorecard
  // ---------------------------------------------------------------------------
  function scoreRun(state, cfg) {
    const m = { economy:state.economy, approval:state.approval, treasury:state.treasury, equality:state.equality };
    const composite = Math.round(0.30*m.economy + 0.25*m.approval + 0.25*m.treasury + 0.20*m.equality);
    const grade = composite>=90?'A+':composite>=80?'A':composite>=70?'B':composite>=57?'C':composite>=44?'D':'F';
    const b = computeBudget(cfg, state);
    const medRate = b.raw.seg[MEDIAN_KEY].effRate;
    const gdpPerCapStart = GDP0 / 0.335; // ~335M people (trillions/?, illustrative)
    const gdpPerCapEnd = state.gdp / 0.335;
    const gdpGrowthTotal = (state.gdp / GDP0 - 1) * 100;

    // Legacy verdict
    let legacy;
    if (m.approval>=65 && m.treasury<40) legacy = 'A beloved populist who left the books a mess.';
    else if (m.treasury>=65 && m.approval<40) legacy = 'A feared austerity hawk — solvent, but resented.';
    else if (m.equality>=65 && m.economy<45) legacy = 'A champion of fairness who throttled growth.';
    else if (m.economy>=65 && m.equality<40) legacy = 'A growth machine that left many behind.';
    else if (composite>=80) legacy = 'A steady hand who balanced every plate.';
    else if (state.endReason && !['completed'].includes(state.endReason)) legacy = `Toppled by ${state.endReason.toLowerCase()} — a cautionary tale.`;
    else if (composite<42) legacy = 'A chaotic tenure best forgotten.';
    else legacy = 'A middling administration — neither triumph nor disaster.';

    return {
      composite, grade, meters:m, legacy,
      debtToGDP: b.dtg, medianEffRate: medRate,
      gdpGrowthTotal, endReason: state.endReason
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Presets
  // ---------------------------------------------------------------------------
  function presets() {
    const cur = defaultConfig();
    const nordic = defaultConfig();
    Object.assign(nordic, {
      brackets: [
        { threshold:0, rate:0.20 }, { threshold:20000, rate:0.32 },
        { threshold:55000, rate:0.44 }, { threshold:90000, rate:0.52 },
        { threshold:600000, rate:0.56 }
      ],
      stdDeduction: 4000, payrollRate: 0.10, corpRate: 0.22,
      capMode:'preferential', capRate:0.30, vatRate:0.25, tariffRate:0.02,
      childGrant: 2000, charityMatch:0
    });
    nordic.spend = Object.assign({}, cur.spend, {
      socialSecurity:1.7, medicare:1.0, health:1.3, defense:0.5,
      incomeSecurity:1.0, education:0.5, science:0.08, transportation:0.2
    });

    // Historical bracket thresholds are converted to present-day dollars so the
    // era's *structure* (where rates bite relative to incomes) is preserved.
    const wwii1944 = defaultConfig();
    Object.assign(wwii1944, {
      brackets: [
        { threshold:0, rate:0.19 }, { threshold:70000, rate:0.41 },
        { threshold:400000, rate:0.62 }, { threshold:1000000, rate:0.78 },
        { threshold:4000000, rate:0.94 }
      ],
      stdDeduction: 9000, payrollRate:0.02, payrollCap:64000, corpRate:0.40,
      capMode:'preferential', capRate:0.25, vatRate:0, tariffRate:0.06,
      estateRate:0.77, estateExemption: 1100000
    });
    wwii1944.spend = Object.assign({}, cur.spend, {
      defense:2.2, socialSecurity:0.4, medicare:0.0, health:0.2,
      incomeSecurity:0.3, education:0.1
    });

    const greatSociety = defaultConfig();
    Object.assign(greatSociety, {
      brackets: [
        { threshold:0, rate:0.14 }, { threshold:80000, rate:0.25 },
        { threshold:350000, rate:0.45 }, { threshold:1200000, rate:0.62 },
        { threshold:5000000, rate:0.70 }
      ],
      stdDeduction: 13000, payrollRate:0.066, payrollCap:78000, corpRate:0.48,
      capMode:'preferential', capRate:0.25, tariffRate:0.04,
      estateRate:0.77, estateExemption: 700000
    });
    greatSociety.spend = Object.assign({}, cur.spend, {
      defense:1.1, socialSecurity:1.0, medicare:0.5, health:0.6,
      incomeSecurity:0.6, education:0.4
    });

    const reagan = defaultConfig();
    Object.assign(reagan, {
      brackets: [ { threshold:0, rate:0.15 }, { threshold:160000, rate:0.28 } ],
      stdDeduction: 13000, payrollRate:0.151, payrollCap:125000, corpRate:0.34,
      capMode:'preferential', capRate:0.28, tariffRate:0.03,
      estateRate:0.55, estateExemption: 1600000
    });
    reagan.spend = Object.assign({}, cur.spend, {
      defense:1.3, socialSecurity:1.2, medicare:0.6, health:0.6,
      incomeSecurity:0.5, education:0.25
    });

    return {
      current:   { name:'Current US',          desc:'The US tax & budget as of FY2024.', cfg:cur },
      nordic:    { name:'Nordic-style',         desc:'High broad taxes (incl. VAT), generous services.', cfg:nordic },
      wwii1944:  { name:'1944 — WWII Peak',      desc:'Top rate 94%, total-war budget.', cfg:wwii1944 },
      society:   { name:'1965 — Great Society',  desc:'Top rate 70%, expanding programs.', cfg:greatSociety },
      reagan:    { name:'1988 — Reagan Reform',  desc:'Just two brackets, top rate 28%.', cfg:reagan }
    };
  }

  // ---------------------------------------------------------------------------
  const API = {
    HH, GDP0, DEBT0, BASE_GROWTH, SEGMENTS, SPEND_CATS, ACTUAL_REV, ACTUAL_SPEND,
    BASE_MEDIAN_BURDEN, BASE_LOW_BURDEN, BASE_SAFETY,
    defaultConfig, computeBudget, computeRaw, meterTargets,
    initialState, simulateTerm, scoreRun, presets, clamp,
    marginalRate, bracketTax
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.TH = API;
})(typeof window !== 'undefined' ? window : this);
