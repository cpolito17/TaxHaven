/* ============================================================================
   TAX HAVEN — UI layer.  Depends on window.TH (engine).
   ========================================================================== */
(function(){
'use strict';
const $ = (s,r=document)=>r.querySelector(s);
const el=(t,p={},...kids)=>{const n=document.createElement(t);
  for(const k in p){ if(k==='class')n.className=p[k]; else if(k==='html')n.innerHTML=p[k];
    else if(k.startsWith('on'))n.addEventListener(k.slice(2),p[k]);
    else if(k==='dataset')Object.assign(n.dataset,p[k]); else n.setAttribute(k,p[k]); }
  for(const c of kids){ if(c==null)continue; n.append(c.nodeType?c:document.createTextNode(c)); } return n;};

/* -------------------------- formatting -------------------------- */
const T  = x => (x<0?'-$':'$')+Math.abs(x).toFixed(2)+'T';
const PCT= x => (x*100).toFixed(x*100>=10?0:1)+'%';
const PCT1=x => (x*100).toFixed(1)+'%';
const money = d => d>=1000 ? '$'+Math.round(d/1000)+'k' : '$'+Math.round(d);
const moneyFull = d => '$'+Math.round(d).toLocaleString();
const round = x => Math.round(x);

/* -------------------------- colors -------------------------- */
const REV_COLORS={individual:'#006D77',payroll:'#83C5BE',corporate:'#0a9396',vat:'#94d2bd',
  tariffs:'#e9d8a6',estate:'#ee9b00',other:'#bcd7d6'};
const REV_LABELS={individual:'Individual income',payroll:'Payroll',corporate:'Corporate',
  vat:'VAT / sales',tariffs:'Tariffs',estate:'Estate',other:'Excise & misc'};
const REV_ORDER=['individual','payroll','corporate','vat','tariffs','estate','other'];
const SP_COLORS={socialSecurity:'#e29578',medicare:'#ffb4a2',health:'#ffcdb2',defense:'#6d6875',
  incomeSecurity:'#f4a261',veterans:'#e76f51',education:'#83c5be',transportation:'#adc178',
  science:'#a8dadc',international:'#cdb4db',other:'#d6ccc2',grants:'#b5838d',netInterest:'#48525a'};
const SP_LABELS={socialSecurity:'Social Security',medicare:'Medicare',health:'Medicaid & Health',
  defense:'Defense',incomeSecurity:'Income Security',veterans:'Veterans',education:'Education',
  transportation:'Transportation',science:'Science',international:'International',other:'Everything Else',
  grants:'Grants & credits',netInterest:'Net interest'};
const SP_ORDER=['socialSecurity','medicare','health','defense','incomeSecurity','veterans',
  'education','transportation','science','international','other','grants','netInterest'];
const METERS=[['economy','Economy','econ','--m-econ'],['approval','Approval','appr','--m-appr'],
  ['treasury','Treasury','treas','--m-treas'],['equality','Equality','equal','--m-equal']];

function heatColor(h){
  h=Math.max(0,Math.min(1,h));
  const a=[0x4a,0x9d,0x95], m=[0xe9,0xa2,0x3b], r=[0xd1,0x49,0x5b];
  let c; if(h<.5){const k=h/.5;c=a.map((v,i)=>v+(m[i]-v)*k);}else{const k=(h-.5)/.5;c=m.map((v,i)=>v+(r[i]-v)*k);}
  return 'rgb('+c.map(Math.round).join(',')+')';
}

/* -------------------------- tooltip -------------------------- */
const tip=$('#tooltip');
function tipHTML(o){
  if(typeof o==='string')return '<span class="tt">'+o+'</span>';
  let s='';
  if(o.what)s+='<span class="tt"><b>What:</b> '+o.what+'</span>';
  if(o.hi)s+='<span class="tt hi"><b>Too high:</b> '+o.hi+'</span>';
  if(o.lo)s+='<span class="tt lo"><b>Too low:</b> '+o.lo+'</span>';
  if(o.an)s+='<span class="tt an"><b>Real world:</b> '+o.an+'</span>';
  return s;
}
function bindTip(node,content){
  node.addEventListener('mouseenter',()=>{ tip.innerHTML=tipHTML(content); tip.classList.add('show'); place(node); });
  node.addEventListener('mousemove',()=>place(node));
  node.addEventListener('mouseleave',()=>tip.classList.remove('show'));
}
function place(node){
  const r=node.getBoundingClientRect();
  const tw=tip.offsetWidth, th=tip.offsetHeight;
  let x=r.left+r.width/2-tw/2, y=r.top-th-10;
  if(y<8){y=r.bottom+10;}
  x=Math.max(8,Math.min(window.innerWidth-tw-8,x));
  tip.style.left=x+'px'; tip.style.top=y+'px';
}

/* ============================ STATE ============================ */
let config, state, seed, best=null, busy=false;
const sliders=[]; let bracketRebuild=null;

function clone(o){return JSON.parse(JSON.stringify(o));}
function loadBest(){ try{return JSON.parse(localStorage.getItem('taxhaven.best'));}catch(e){return null;} }
function saveBest(o){ try{localStorage.setItem('taxhaven.best',JSON.stringify(o));}catch(e){} }

/* ============================ CONTROL BUILDERS ============================ */
// slider: {bind:[obj,key] or get/set, min,max,step, fmt, tip, heat(cfg,b), accent}
function makeSlider(o){
  const read=el('span',{class:'read'});
  const info=o.tip?bindInfo(o.tip):null;
  const nameEl=el('span',{class:'name'}, o.label, info);
  const input=el('input',{type:'range',min:o.min,max:o.max,step:o.step});
  input.value=o.get();
  const wrap=el('div',{class:'ctrl'}, el('div',{class:'lab'},nameEl,read), input);
  const sl={input,read,fmt:o.fmt,heat:o.heat||(()=>0),accent:o.accent,min:o.min,max:o.max,get:o.get};
  input.addEventListener('input',()=>{ o.set(parseFloat(input.value)); updateSlider(sl); recompute(); });
  sliders.push(sl);
  return wrap;
}
function bindInfo(t){ const i=el('span',{class:'info'},'i'); bindTip(i,t); return i; }
function updateSlider(sl){
  const v=sl.get();
  const fill=((v-sl.min)/(sl.max-sl.min))*100;
  const h=sl.heat(config,window.__b||null);
  const col= sl.accent ? sl.accent : heatColor(h);
  sl.input.style.setProperty('--track',`linear-gradient(90deg,${col} 0%,${col} ${fill}%,#e3eef0 ${fill}%,#e3eef0 100%)`);
  sl.input.style.setProperty('--thumb',col);
  sl.read.textContent=sl.fmt(v);
  if(parseFloat(sl.input.value)!==v) sl.input.value=v;
}
function makeToggle(o){
  const info=o.tip?bindInfo(o.tip):null;
  const sw=el('span',{class:'switch'});
  const t=el('label',{class:'toggle'+(o.get()?' on':'')}, el('span',{class:'name',style:'font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:6px'},o.label,info), sw);
  t.addEventListener('click',e=>{ if(e.target.tagName==='A')return; const nv=!o.get(); o.set(nv); t.classList.toggle('on',nv); o.after&&o.after(nv); recompute(); });
  return el('div',{class:'ctrl'},t);
}
function makeSelect(o){
  const info=o.tip?bindInfo(o.tip):null;
  const sel=el('select');
  o.options.forEach(([val,lab])=>sel.append(el('option',{value:val},lab)));
  sel.value=o.get();
  sel.addEventListener('change',()=>{ o.set(sel.value); o.after&&o.after(sel.value); recompute(); });
  return el('div',{class:'ctrl'},el('div',{class:'lab'},el('span',{class:'name'},o.label,info),el('span')),sel);
}
function group(title,opts={}){ const g=el('div',{class:'group'+(opts.span?' span2':'')}); if(title)g.append(el('div',{class:'g-title'},title)); return g; }

/* ============================ TOOLTIP TEXT ============================ */
const TIP={
  brackets:{what:'Marginal income-tax bands: each rate applies only to income within that band.',
    hi:'Push top rates past ~60% and high earners shelter, defer, or leave — revenue can fall (the Laffer effect).',
    lo:'Set rates too low and you starve the budget, forcing deficits and debt.',
    an:'The US top rate is 37%; it was 94% in 1944 and 28% in 1988.'},
  stdDeduction:{what:'Income everyone earns tax-free before any bracket applies.',
    hi:'A very high exemption is popular but blows a hole in revenue.',
    lo:'A low exemption taxes the working poor from the first dollar — politically explosive.',
    an:'The 2024 US standard deduction is $14,600 (single).'},
  payroll:{what:'Combined Social Security + Medicare tax on wages, funding those programs.',
    hi:'Above ~16% it bites take-home pay hard and, capped, hits low earners worst.',
    lo:'Cut it and you must fund Social Security & Medicare some other way.',
    an:'The US combined payroll rate is 15.3%, capped near $168k of wages.'},
  corp:{what:'Tax on corporate profits.',
    hi:'Set far above the top individual rate and you blunt investment and push profits offshore.',
    lo:'Set far below the individual top rate and you invite income to hide inside corporations.',
    an:'The US corporate rate is 21% (was 35% before 2018).'},
  capMode:{what:'How capital gains & dividends are taxed.',
    hi:'Taxing capital at full ordinary rates raises equality but capital is the most mobile base.',
    lo:'A low preferential rate favors the wealthy, who earn most capital income.',
    an:'The US taxes long-term gains at a preferential ~20%.'},
  capRate:{what:'The flat rate on capital gains under preferential/custom mode.',
    hi:'Past ~45% capital flees fast — the base shrinks more than the rate rises.',
    lo:'A very low rate is a large, regressive giveaway to top earners.',
    an:'US long-term capital gains top out near 20% (23.8% with the surtax).'},
  steppedUp:{what:'Eliminate the "stepped-up basis" that wipes out capital-gains tax at death.',
    hi:'Closing it raises revenue and equality, but is fiercely lobbied against.',
    lo:'Leaving it open lets the largest fortunes pass untaxed across generations.',
    an:'Stepped-up basis is one of the biggest tax breaks for inherited wealth.'},
  indexInfl:{what:'Index the cost basis of assets to inflation before taxing gains.',
    hi:'Indexing is fairer but shrinks the taxable base and revenue.',
    lo:'Without it, investors are taxed on purely inflationary "gains".',
    an:'A long-debated reform; never enacted federally.'},
  vat:{what:'A broad national sales / value-added tax on consumption.',
    hi:'Efficient at raising money, but regressive — it hits low earners hardest.',
    lo:'Leaving it at zero forgoes a large, stable revenue source.',
    an:'Most rich nations have a VAT of 15–25%; the US has none.'},
  tariffs:{what:'Taxes on imported goods.',
    hi:'High tariffs raise consumer prices and invite retaliation that closes export markets.',
    lo:'Low tariffs mean cheaper goods but little revenue from trade.',
    an:'US effective tariffs average a few percent.'},
  filing:{what:'Let married couples double each bracket width (file jointly).',
    hi:'Doubling brackets is a big break for single-earner couples and cuts revenue.',
    lo:'Turning it off raises taxes on most middle-class households.',
    an:'US joint filers get roughly doubled brackets vs. singles.'},
  estate:{what:'Tax on large fortunes passed at death.',
    hi:'Very high estate rates push the wealthy into avoidance structures.',
    lo:'A tiny estate tax lets dynastic wealth compound untaxed.',
    an:'The US estate tax is 40% above a ~$13.6M exemption.'},
  estateRate:{what:'The rate applied to estates above the exemption.',hi:'Past ~70% avoidance dominates.',lo:'Low rates raise little.',an:'The US rate is 40%.'},
  rolling:{what:'Apply brackets to a 5-year trailing average of income.',
    hi:'Smoothing strongly dampens how violently booms and busts swing revenue — great for stability.',
    lo:'Off, revenue whipsaws with the economy and your changes bite instantly.',
    an:'An innovation lever: trades instant response for resilience to shocks.'},
  childGrant:{what:'Cash paid per child each year, visibly, not as a buried credit.',
    hi:'Generous grants lift equality and approval but cost real money.',
    lo:'Nothing here means no direct support for families.',
    an:'Like an expanded Child Tax Credit, paid as cash.'},
  homeowner:{what:'A grant to first-time homebuyers.',hi:'Costly and can inflate prices.',lo:'No help onto the housing ladder.',an:'Targets the middle class.'},
  charity:{what:'Government matches a fraction of every dollar donated to charity.',hi:'Expensive and gameable.',lo:'No incentive to give.',an:'A direct match instead of a deduction.'},
  // budget
  socialSecurity:{what:'Pensions for retirees and the disabled — the largest federal program.',
    hi:'Generous benefits buy approval but strain the budget.',
    lo:'Cutting it hard triggers revolt among seniors and the vulnerable.',
    an:'~$1.46T/yr, about a fifth of all spending.'},
  medicare:{what:'Health coverage for seniors.',hi:'Costs balloon with generosity.',lo:'Cuts hit seniors and approval.',an:'~$0.85T/yr.'},
  health:{what:'Medicaid and other health spending for lower-income people.',hi:'Expensive.',lo:'Cuts raise inequality and risk a health crisis.',an:'~$0.9T/yr.'},
  defense:{what:'The military budget.',
    hi:'Past ~$1.5T it provokes Sanctions/retaliation and crowds out everything else.',
    lo:'Too low invites a security shock.',
    an:'~$0.87T/yr, the largest discretionary line.'},
  incomeSecurity:{what:'The safety net: unemployment, food aid, tax credits.',hi:'Costly.',lo:'Cuts hit the poor hardest and risk revolt.',an:'~$0.67T/yr.'},
  veterans:{what:'Benefits and care for veterans.',hi:'Costly.',lo:'Cuts are politically toxic.',an:'~$0.32T/yr.'},
  education:{what:'Federal education & training — a slow-burn growth investment.',hi:'Diminishing returns.',lo:'Underinvesting drags future growth.',an:'~$0.27T/yr.'},
  transportation:{what:'Infrastructure: roads, transit, airports — boosts future Economy.',hi:'Eventually low returns.',lo:'Crumbling infrastructure slows growth.',an:'~$0.13T/yr.'},
  science:{what:'Research & space — long-horizon growth investment.',hi:'Hard to spend well fast.',lo:'Underfunding cedes the technological edge.',an:'~$0.04T/yr.'},
  international:{what:'Foreign aid and diplomacy.',hi:'Politically unpopular when large.',lo:'Retreat cedes global influence.',an:'~$0.06T/yr.'},
  budgetOther:{what:'Everything else: justice, agriculture, energy, administration.',hi:'Bloat.',lo:'Government stops functioning.',an:'~$0.30T/yr.'},
  stabFund:{what:'Bank a share of surpluses; auto-draws to cushion downturn shocks.',
    hi:'Over-saving parks money that could buy services now (opportunity cost).',
    lo:'Off, a recession hits the Treasury and approval at full force.',
    an:'An innovation lever: a sovereign rainy-day fund.'},
  surplusShare:{what:'Fraction of any surplus diverted into the stabilization fund.',hi:'Starves current services.',lo:'Fund fills too slowly to matter.',an:'Norway saves most of its oil surplus.'}
};

/* ============================ BUILD INCOME ============================ */
function buildIncome(){
  const root=$('#income-controls'); root.innerHTML='';
  sliders.length=0;                 // rebuild registry (budget sliders re-added after)
  config.__tabAccent='#4a9d95';

  // Presets
  const gp=group('Load a starting point',{span:true});
  const pr=el('div',{class:'presets'});
  const presets=TH.presets();
  for(const k in presets){ const p=presets[k];
    pr.append(el('button',{class:'preset',onclick:()=>loadPreset(k)},
      el('span',{class:'pn'},p.name), el('span',{class:'pd'},p.desc))); }
  gp.append(pr); root.append(gp);

  // Brackets
  const gb=group('Income tax brackets',{span:true});
  const list=el('div',{class:'brackets',id:'band-list'});
  const samples=el('div',{class:'samples',id:'samples'});
  const addBtn=el('button',{class:'band-add',id:'band-add',onclick:addBand},'+ Add band');
  gb.append(bindInfoBlock('Marginal vs. average rate',TIP.brackets), list, addBtn, samples);
  root.append(gb);
  bracketRebuild=()=>{ buildBands(list); updateBandAdd(addBtn); };
  bracketRebuild();

  // Deductions & payroll
  const g1=group('Deductions & payroll');
  g1.append(makeSlider({label:'Standard deduction',tip:TIP.stdDeduction,min:0,max:60000,step:500,
    get:()=>config.stdDeduction,set:v=>config.stdDeduction=v,fmt:moneyFull,
    heat:c=>TH.clamp((c.stdDeduction-42000)/30000,0,1)}));
  g1.append(makeSlider({label:'Payroll tax (SS + Medicare)',tip:TIP.payroll,min:0,max:0.30,step:0.005,
    get:()=>config.payrollRate,set:v=>config.payrollRate=v,fmt:PCT1,
    heat:c=>TH.clamp((c.payrollRate-0.16)/0.12,0,1)}));
  root.append(g1);

  // Business & capital
  const g2=group('Business & capital');
  g2.append(makeSlider({label:'Corporate income tax',tip:TIP.corp,min:0,max:0.50,step:0.01,
    get:()=>config.corpRate,set:v=>config.corpRate=v,fmt:PCT1,
    heat:c=>TH.clamp((c.corpRate-0.28)/0.22,0,1)}));
  g2.append(makeSelect({label:'Capital gains treatment',tip:TIP.capMode,
    options:[['ordinary','Taxed as ordinary income'],['preferential','Preferential flat rate'],['custom','Custom flat rate']],
    get:()=>config.capMode,set:v=>config.capMode=v,after:()=>refreshCapVisibility()}));
  const capSliderWrap=makeSlider({label:'Capital gains rate',tip:TIP.capRate,min:0,max:0.60,step:0.01,
    get:()=>config.capRate,set:v=>config.capRate=v,fmt:PCT1,
    heat:c=>TH.clamp((c.capRate-0.40)/0.30,0,1)});
  capSliderWrap.id='cap-rate-ctrl';
  g2.append(capSliderWrap);
  g2.append(makeToggle({label:'Eliminate stepped-up basis at death',tip:TIP.steppedUp,
    get:()=>config.steppedUpElim,set:v=>config.steppedUpElim=v}));
  g2.append(makeToggle({label:'Index basis to inflation',tip:TIP.indexInfl,
    get:()=>config.indexInflation,set:v=>config.indexInflation=v}));
  root.append(g2);

  // Consumption & trade
  const g3=group('Consumption & trade');
  g3.append(makeSlider({label:'VAT / national sales tax',tip:TIP.vat,min:0,max:0.25,step:0.005,
    get:()=>config.vatRate,set:v=>config.vatRate=v,fmt:PCT1,
    heat:c=>TH.clamp((c.vatRate-0.05)/0.18,0,1)}));
  g3.append(makeSlider({label:'Tariffs',tip:TIP.tariffs,min:0,max:0.30,step:0.005,
    get:()=>config.tariffRate,set:v=>config.tariffRate=v,fmt:PCT1,
    heat:c=>TH.clamp((c.tariffRate-0.06)/0.14,0,1)}));
  root.append(g3);

  // Wealth & status
  const g4=group('Wealth & filing');
  g4.append(makeToggle({label:'Estate / wealth tax',tip:TIP.estate,
    get:()=>config.estateEnabled,set:v=>config.estateEnabled=v}));
  g4.append(makeSlider({label:'Estate tax rate',tip:TIP.estateRate,min:0,max:0.90,step:0.01,
    get:()=>config.estateRate,set:v=>config.estateRate=v,fmt:PCT1,
    heat:c=>TH.clamp((c.estateRate-0.70)/0.20,0,1)}));
  g4.append(makeToggle({label:'Married brackets doubled (file jointly)',tip:TIP.filing,
    get:()=>config.filingDouble,set:v=>config.filingDouble=v}));
  root.append(g4);

  // Grants
  const g5=group('Grants — paid as visible year-end cash');
  g5.append(makeSlider({label:'Child grant (per child / yr)',tip:TIP.childGrant,min:0,max:6000,step:100,
    get:()=>config.childGrant,set:v=>config.childGrant=v,fmt:moneyFull,accent:'#4a9d95'}));
  g5.append(makeSlider({label:'First-time homebuyer grant',tip:TIP.homeowner,min:0,max:30000,step:500,
    get:()=>config.homeownerGrant,set:v=>config.homeownerGrant=v,fmt:moneyFull,accent:'#4a9d95'}));
  g5.append(makeSlider({label:'Charitable match (per $ donated)',tip:TIP.charity,min:0,max:1,step:0.05,
    get:()=>config.charityMatch,set:v=>config.charityMatch=v,fmt:PCT1,accent:'#4a9d95'}));
  root.append(g5);

  // Smoothing
  const g6=group('Stability');
  g6.append(makeToggle({label:'Five-year rolling-average income basis',tip:TIP.rolling,
    get:()=>config.rollingAvg,set:v=>config.rollingAvg=v}));
  root.append(g6);

  root.append(dataNote());
  refreshCapVisibility();
}
function dataNote(){ return el('div',{class:'span2',style:'text-align:center;color:var(--muted);font-size:11px;line-height:1.5;padding:4px 0 0'},
  'About the data: baseline calibrated to approximate US FY2024 federal actuals (receipts by source, outlays by category, debt-to-GDP). A teaching toy — directionally honest, not a macroeconomic forecast.'); }
function bindInfoBlock(label,t){ const d=el('div',{style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px'},
  el('span',{style:'font-size:12.5px;color:var(--muted);font-weight:600'},'Each rate applies only to income inside its band.'),
  bindInfo(t)); return d; }
function refreshCapVisibility(){ const c=$('#cap-rate-ctrl'); if(c)c.style.display=config.capMode==='ordinary'?'none':''; }

/* ----- bracket bands ----- */
function buildBands(list){
  list.innerHTML='';
  for(let i=sliders.length-1;i>=0;i--) if(sliders[i].isBand) sliders.splice(i,1); // drop stale band sliders
  config.brackets.forEach((band,i)=>{
    const next=config.brackets[i+1];
    const upper=next?money(next.threshold):'+';
    const fromInput=el('input',{type:'number',min:0,step:1000,value:band.threshold});
    fromInput.addEventListener('change',()=>{ band.threshold=Math.max(0,parseInt(fromInput.value)||0); sortBands(); bracketRebuild(); recompute(); });
    const rate=el('input',{type:'range',min:0,max:1,step:0.01,value:band.rate});
    const rv=el('span',{class:'ratev'},PCT1(band.rate));
    const sl={input:rate,read:rv,fmt:PCT1,min:0,max:1,get:()=>band.rate,isBand:true,
      heat:()=>{ let h=TH.clamp((band.rate-0.50)/0.45,0,1);
        if(i===0||band.threshold<30000) h=Math.max(h,TH.clamp((band.rate-0.12)/0.25,0,1));
        return h; }};
    rate.addEventListener('input',()=>{ band.rate=parseFloat(rate.value); updateSlider(sl); recompute(); });
    sliders.push(sl);
    const rm=el('button',{class:'rm',title:'Remove band',onclick:()=>removeBand(i)},'×');
    const row=el('div',{class:'band'+(i===0?' locked-from':'')},
      el('div',{class:'from'}, i===0?el('span',{},'from $0'):fromWrap(fromInput) ),
      rate, rv, config.brackets.length>1?rm:el('span'));
    list.append(row);
    updateSlider(sl);
  });
}
function fromWrap(input){ return el('span',{},'$',input); }
function sortBands(){ config.brackets.sort((a,b)=>a.threshold-b.threshold); config.brackets[0].threshold=0; }
function addBand(){ if(config.brackets.length>=7)return;
  const last=config.brackets[config.brackets.length-1];
  const nt=last.threshold<10000?50000:Math.round(last.threshold*2);
  config.brackets.push({threshold:nt,rate:Math.min(0.99,last.rate+0.05)});
  sortBands(); bracketRebuild(); recompute(); }
function removeBand(i){ if(config.brackets.length<=1)return; config.brackets.splice(i,1); config.brackets[0].threshold=0; bracketRebuild(); recompute(); }
function updateBandAdd(btn){ btn.disabled=config.brackets.length>=7; }

/* ============================ BUILD BUDGET ============================ */
function buildBudget(){
  const root=$('#budget-controls'); root.innerHTML='';
  config.__tabAccent='#e8997f';
  const lowDanger=key=>{ const base=TH.defaultConfig().spend[key];
    return c=>TH.clamp((base*0.6 - c.spend[key])/(base*0.6),0,1); };

  const g1=group('Safety net & health');
  [['socialSecurity',TIP.socialSecurity,3.0],['medicare',TIP.medicare,2.0],['health',TIP.health,2.5],
   ['incomeSecurity',TIP.incomeSecurity,2.0],['veterans',TIP.veterans,1.0]].forEach(([k,tp,mx])=>{
    g1.append(budgetSlider(k,tp,mx,lowDanger(k))); });
  root.append(g1);

  const g2=group('Defense & investment');
  g2.append(budgetSlider('defense',TIP.defense,3.5,c=>TH.clamp((c.spend.defense-1.5)/1.3,0,1)));
  g2.append(budgetSlider('education',TIP.education,1.5,()=>0));
  g2.append(budgetSlider('transportation',TIP.transportation,1.0,()=>0));
  g2.append(budgetSlider('science',TIP.science,0.6,()=>0));
  root.append(g2);

  const g3=group('Other & forced');
  g3.append(budgetSlider('international',TIP.international,0.6,()=>0));
  g3.append(budgetSlider('other',TIP.budgetOther,1.2,()=>0));
  const lock=el('div',{class:'locked-line',id:'net-interest-line'},
    el('span',{},el('span',{class:'lk'},'forced'),' Net interest on the debt ',bindInfo({what:'Interest owed on accumulated debt — you cannot slide it.',hi:'It grows as debt grows, crowding out every other priority.',lo:'Only falls by running surpluses and paying debt down.',an:'Already ~$0.9T/yr and the fastest-growing line in the US budget.'})),
    el('span',{class:'read mono',id:'net-interest-val'},'—'));
  g3.append(lock);
  root.append(g3);

  const g4=group('Revenue stabilization fund');
  g4.append(makeToggle({label:'Enable rainy-day fund',tip:TIP.stabFund,
    get:()=>config.stabFund,set:v=>config.stabFund=v}));
  g4.append(makeSlider({label:'Share of surplus to divert',tip:TIP.surplusShare,min:0,max:0.8,step:0.05,
    get:()=>config.surplusShare,set:v=>config.surplusShare=v,fmt:PCT1,accent:'#e8997f'}));
  root.append(g4);
  root.append(dataNote());
}
function budgetSlider(key,tip,max,heat){
  return makeSlider({label:SP_LABELS[key],tip,min:0,max,step:0.01,
    get:()=>config.spend[key],set:v=>config.spend[key]=v,fmt:T,heat});
}

/* ============================ PIE + LEGEND ============================ */
const C=2*Math.PI*70;
function ensurePie(id,keys,colors){
  const wrap=$('#'+id);
  if(wrap.dataset.built){return wrap.__circles;}
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg'); svg.setAttribute('viewBox','0 0 200 200'); svg.setAttribute('width','240'); svg.setAttribute('height','240');
  const bg=document.createElementNS(NS,'circle'); bg.setAttribute('cx',100);bg.setAttribute('cy',100);bg.setAttribute('r',70);
  bg.setAttribute('fill','none');bg.setAttribute('stroke','#eef4f5');bg.setAttribute('stroke-width',32); svg.append(bg);
  const circles={};
  keys.forEach(k=>{ const c=document.createElementNS(NS,'circle');
    c.setAttribute('cx',100);c.setAttribute('cy',100);c.setAttribute('r',70);c.setAttribute('fill','none');
    c.setAttribute('stroke',colors[k]);c.setAttribute('stroke-width',32);
    c.setAttribute('stroke-dasharray','0 '+C); c.setAttribute('stroke-dashoffset','0');
    svg.append(c); circles[k]=c; });
  wrap.append(svg);
  const center=el('div',{class:'pie-center'}, el('div',{class:'big',id:id+'-total'},''), el('div',{class:'sub'},id==='pie-income'?'revenue':'spending'));
  wrap.append(center);
  wrap.dataset.built='1'; wrap.__circles=circles; return circles;
}
function renderPie(id,entries){ // entries:[{key,value}]
  const total=entries.reduce((a,e)=>a+Math.max(0,e.value),0);
  const colors=id==='pie-income'?REV_COLORS:SP_COLORS;
  const keys=entries.map(e=>e.key);
  const circles=ensurePie(id,keys,colors);
  let cum=0;
  entries.forEach(e=>{ const c=circles[e.key]; if(!c)return;
    const frac=total>0?Math.max(0,e.value)/total:0; const len=frac*C;
    c.setAttribute('stroke-dasharray',len.toFixed(2)+' '+(C-len).toFixed(2));
    c.setAttribute('stroke-dashoffset',(-cum).toFixed(2)); cum+=len; });
  $('#'+id+'-total').textContent=T(total);
}
function renderLegend(id,entries,opts={}){
  const root=$('#'+id); root.innerHTML='';
  const colors=id==='legend-income'?REV_COLORS:SP_COLORS;
  const labels=id==='legend-income'?REV_LABELS:SP_LABELS;
  const total=entries.reduce((a,e)=>a+Math.max(0,e.value),0);
  entries.forEach(e=>{ const pct=total>0?(Math.max(0,e.value)/total*100):0;
    root.append(el('div',{class:'row'+(e.value<=0.0005?' dim':'')},
      el('span',{class:'sw',style:'background:'+colors[e.key]}),
      el('span',{class:'lbl'},labels[e.key], e.key==='netInterest'?el('span',{class:'locked',style:'margin-left:6px'},'locked'):null),
      el('span',{class:'amt'},T(e.value)),
      el('span',{class:'pct'},pct.toFixed(0)+'%'))); });
}

/* ============================ METERS / LEDGER / ACTION ============================ */
function buildMeters(){
  const root=$('#meters'); root.innerHTML='';
  METERS.forEach(([key,label,cls,cssvar])=>{
    const w=el('div',{class:'meter '+cls,id:'meter-'+key},
      el('div',{class:'top'},el('span',{},label),el('span',{class:'val',id:'mval-'+key},'')),
      el('div',{class:'bar'},el('div',{class:'fill',id:'mfill-'+key}),el('div',{class:'tick',id:'mtick-'+key})),
      el('div',{class:'fig',id:'mfig-'+key},''));
    bindTip(w,'');
    w.addEventListener('mouseenter',()=>{ tip.innerHTML=tipHTML(meterTip(key)); place(w); });
    root.append(w);
  });
}
function meterTip(key){
  const b=window.__b, t=window.__t;
  if(key==='economy')return {what:'Standard of living & GDP growth.',an:'Now: GDP $'+state.gdp.toFixed(1)+'T, growing ~'+PCT1(t.growth)+'/yr.'};
  if(key==='approval')return {what:'Public approval of your government.',an:'Now: '+round(state.approval)+'% approval. Below ~35% invites catastrophe.'};
  if(key==='treasury')return {what:'Fiscal health — balance & debt.',an:'Now: '+(b.balance>=0?'surplus ':'deficit ')+T(Math.abs(b.balance))+', debt-to-GDP '+(b.dtg*100).toFixed(0)+'%.'};
  if(key==='equality')return {what:'How fairly the burden & benefits are shared.',an:'Now: inequality (Gini) ≈ '+gini().toFixed(2)+'.'};
}
function gini(){ return 0.58 - state.equality/100*0.26; }
function renderMeters(){
  const t=window.__t;
  METERS.forEach(([key])=>{
    $('#mfill-'+key).style.width=state[key]+'%';
    $('#mtick-'+key).style.left=t[key]+'%';
    $('#mval-'+key).textContent=round(state[key]);
  });
  const b=window.__b;
  $('#mfig-economy').textContent='GDP +'+PCT1(t.growth)+'/yr';
  $('#mfig-approval').textContent=round(state.approval)+'% approval';
  $('#mfig-treasury').textContent='debt/GDP '+(b.dtg*100).toFixed(0)+'%';
  $('#mfig-equality').textContent='Gini ≈ '+gini().toFixed(2);
}
function renderLedger(){
  const b=window.__b; const root=$('#ledger'); root.innerHTML='';
  const bal=b.balance;
  root.append(
    el('div',{class:'item'},el('span',{class:'k'},'Revenue'),el('span',{class:'v'},T(b.grossRevenue))),
    el('div',{class:'item'},el('span',{class:'k'},'Spending'),el('span',{class:'v'},T(b.totalSpend))),
    el('div',{class:'item'},el('span',{class:'k'},bal>=0?'Surplus':'Deficit'),el('span',{class:'v '+(bal>=0?'pos':'neg')},T(Math.abs(bal)))));
}
function renderAction(){
  const b=window.__b; const bal=b.balance;
  $('#bal-lab').textContent=bal>=0?'Projected surplus':'Projected deficit';
  const v=$('#bal-val'); v.textContent=(bal>=0?'+':'−')+T(Math.abs(bal)).replace('$','$'); v.className='v '+(bal>=0?'pos':'neg');
  $('#bal-sub').textContent=bal>=0?'paying down debt':'added to $'+state.debt.toFixed(1)+'T debt';
}
function updateTermCounter(){
  const up=state.term+1; const y0=state.term*4+1, y1=state.term*4+4;
  $('#term-counter').textContent='Term '+Math.min(up,3)+' · Year '+y0+'–'+y1+' of 12';
  $('#simulate').textContent='Simulate Term '+up+' →';
}

/* ============================ RECOMPUTE ============================ */
function recompute(){
  const b=TH.computeBudget(config,state);
  const t=TH.meterTargets(b,config,state);
  window.__b=b; window.__t=t;
  renderPie('pie-income',REV_ORDER.map(k=>({key:k,value:b.revenueBySource[k]})));
  renderLegend('legend-income',REV_ORDER.map(k=>({key:k,value:b.revenueBySource[k]})));
  renderPie('pie-budget',SP_ORDER.map(k=>({key:k,value:b.spendBySource[k]})));
  renderLegend('legend-budget',SP_ORDER.map(k=>({key:k,value:b.spendBySource[k]})));
  const niv=$('#net-interest-val'); if(niv)niv.textContent=T(b.netInterest);
  renderMeters(); renderLedger(); renderAction();
  sliders.forEach(updateSlider);
  updateBandSamples();
}
function updateBandSamples(){
  const box=$('#samples'); if(!box)return;
  const b=window.__b; const seg=b.raw.seg;
  const picks=[['poor','$20k'],['middle','$75k'],['affluent','$300k'],['top01','$5M']];
  box.innerHTML='';
  picks.forEach(([k,lab])=>{ const s=seg[k];
    box.append(el('div',{class:'s'},el('div',{class:'i'},lab),
      el('div',{class:'r'},PCT(s.effRate),el('br'),el('small',{},'avg rate')))); });
}

/* ============================ SIMULATE FLOW ============================ */
function doSimulate(){
  if(busy||state.ended)return; busy=true;
  $('#simulate').disabled=true;
  const res=TH.simulateTerm(state,config,seed);
  recompute(); updateTermCounter();
  showEvents(res.events,0,()=>showReport(res));
}
function showEvents(list,i,done){
  const layer=$('#event-layer');
  if(i>=list.length){ layer.classList.remove('show'); layer.innerHTML=''; done(); return; }
  const ev=list[i];
  const ico={Revolt:'🔥','Capital Flight':'🛫','Brain Drain':'🧠','Sanctions & Retaliation':'⚔️','Debt Downgrade':'📉',
    Recession:'📉',Pandemic:'🦠','Oil Shock':'🛢️','Economic Boom':'📈','Tech Boom':'🚀'}[ev.name]||'⚡';
  const kind=ev.type==='policy'?'Policy backfire':(ev.palette==='good'?'Lucky break':'Exogenous shock');
  const effects=el('div',{class:'ev-effects'});
  ['economy','approval','treasury','equality'].forEach(k=>{ if(ev.effect[k]){ const v=ev.effect[k];
    effects.append(el('span',{class:'eff-chip '+(v>0?'up':'down')}, (v>0?'+':'')+v.toFixed(0)+' '+k.charAt(0).toUpperCase()+k.slice(1))); }});
  const card=el('div',{class:'event-card '+ev.palette},
    el('div',{class:'ev-band'},el('span',{class:'ev-ico'},ico),
      el('div',{},el('div',{class:'ev-kind'},kind),el('div',{class:'ev-name'},ev.name))),
    el('div',{class:'ev-body'}, el('div',{class:'ev-text'},ev.text), effects,
      el('button',{class:'ev-cont',onclick:()=>showEvents(list,i+1,done)}, i+1<list.length?'Next →':'Continue →')));
  layer.innerHTML=''; layer.append(card); layer.classList.add('show');
}
function showReport(res){
  const before=res.before, after=res.after;
  const moves=el('div',{class:'meter-moves'});
  METERS.forEach(([key,label])=>{ const d=after[key]-before[key];
    moves.append(el('div',{class:'mm'},el('div',{class:'mt'},label),
      el('div',{class:'mv'},el('span',{class:'now'},round(after[key])),
        Math.abs(d)>=0.5?el('span',{class:'ch '+(d>0?'up':'down')},(d>0?'▲':'▼')+Math.abs(d).toFixed(0)):el('span',{class:'ch'},'—')))); });
  const chain=el('div',{class:'chain'});
  if(res.chain.length===0) chain.append(el('div',{class:'c'},el('span',{class:'ic',style:'background:#bcd'}),'A quiet term — your settings held the country roughly steady.'));
  res.chain.forEach(l=>chain.append(el('div',{class:'c '+(l.meter||'event')},el('span',{class:'ic'}),l.text)));
  const ended=state.ended;
  const btn=el('button',{class:'btn btn-primary',onclick:()=>{ closeOverlay(); if(ended)showScorecard(); else{ busy=false; $('#simulate').disabled=false; recompute(); } }},
    ended?'See your legacy →':'Continue to next term →');
  openModal(el('div',{class:'modal wide report',dataset:{dismiss:'0'}},
    el('div',{class:'term-tag'},'Term '+state.term+' resolved'),
    el('h2',{},'What happened & why'),
    el('p',{class:'lead'},'Every meter move traces back to a choice you made.'),
    moves, chain,
    el('div',{class:'close-row'},btn)));
}

/* ============================ SCORECARD ============================ */
function showScorecard(){
  const sc=TH.scoreRun(state,config);
  $('#simulate').textContent='Campaign complete'; $('#simulate').disabled=true;
  const isNew=!best||sc.composite>best.composite;
  if(isNew){ best={composite:sc.composite,grade:sc.grade}; saveBest(best); }
  const fm=el('div',{class:'final-meters'});
  METERS.forEach(([key,label])=>fm.append(el('div',{class:'fm'},el('div',{class:'l'},label),el('div',{class:'v'},round(sc.meters[key])))));
  const hl=el('div',{class:'headlines'},
    headline('Final debt-to-GDP',(sc.debtToGDP*100).toFixed(0)+'%'),
    headline("Median household's effective tax rate",PCT(sc.medianEffRate)),
    headline('GDP growth over 12 years',(sc.gdpGrowthTotal>=0?'+':'')+sc.gdpGrowthTotal.toFixed(0)+'%'));
  const endNote = sc.endReason && sc.endReason!=='completed'
    ? el('div',{class:'endr'},'⚠ Your term ended early: '+sc.endReason+'.')
    : el('div',{class:'endr'},'You served all three terms.');
  openModal(el('div',{class:'modal wide',dataset:{dismiss:'0'}},
    el('div',{class:'score-hero'},
      el('div',{class:'grade-badge'},el('div',{class:'g'},sc.grade),el('div',{class:'s'},sc.composite+'/100')),
      el('div',{}, el('h2',{style:'margin-bottom:2px'},'Your legacy'),
        el('div',{class:'legacy'},sc.legacy), endNote)),
    fm, hl,
    el('div',{class:'best '+(isNew?'new':'old')}, isNew?('🏆 New best score: '+sc.composite+' ('+sc.grade+')!'):('Your best score: '+(best?best.composite+' ('+best.grade+')':'—'))),
    el('div',{class:'datanote'},'Baseline calibrated to approximate US FY2024 federal actuals (receipts, outlays, debt-to-GDP). A teaching toy — directionally honest, not a forecast.'),
    el('div',{class:'close-row'},
      el('button',{class:'btn btn-ghost',onclick:()=>{ closeOverlay(); }},'Review final policy'),
      el('button',{class:'btn btn-primary',onclick:replay},'Play again →'))));
}
function headline(k,v){ return el('div',{class:'hl'},el('span',{class:'k'},k),el('span',{class:'v'},v)); }
function replay(){ closeOverlay(); state=TH.initialState(); seed=(Math.random()*1e9)|0; busy=false; $('#simulate').disabled=false; updateTermCounter(); recompute(); switchTab('income'); }

/* ============================ OVERLAY / ONBOARDING ============================ */
function openModal(node){ const root=$('#overlay-root'); root.innerHTML=''; const ov=el('div',{class:'overlay'},node); ov.addEventListener('mousedown',e=>{ if(e.target===ov && node.dataset.dismiss!=='0') closeOverlay(); }); root.append(ov); }
function closeOverlay(){ $('#overlay-root').innerHTML=''; }
function showOnboarding(){
  const steps=[['1','<b>Redesign the tax code & budget.</b> Drag any lever on the Income and Budget tabs — realistic or not.'],
    ['2','<b>Watch the four meters.</b> Economy, Approval, Treasury and Equality react live as you edit. Hover any control for what it does.'],
    ['3','<b>Mind the spine.</b> Revenue minus spending is your balance; deficits pile into debt, and net interest becomes a bill you can\'t cut.'],
    ['4','<b>Simulate a term.</b> Four years pass, events strike, and a panel explains exactly why each meter moved. Survive three terms — twelve years.']];
  const list=el('div',{class:'howto-list'});
  steps.forEach(([n,t])=>list.append(el('div',{class:'h'},el('div',{class:'n'},n),el('div',{class:'t',html:t}))));
  const m=el('div',{class:'modal',dataset:{dismiss:'0'}},
    el('h2',{},'You are now ruler of the United States.'),
    el('p',{class:'lead'},'Redesign America\'s federal taxes and budget however you like — then live with the consequences.'),
    list,
    el('div',{class:'close-row'},el('button',{class:'btn btn-primary',onclick:()=>{ closeOverlay(); try{localStorage.setItem('taxhaven.seen','1');}catch(e){} }},'Take office →')));
  openModal(m);
}

/* ============================ TABS ============================ */
function switchTab(name){
  $$('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  $('#panel-income').classList.toggle('hidden',name!=='income');
  $('#panel-budget').classList.toggle('hidden',name!=='budget');
}
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

/* ============================ PRESETS ============================ */
function loadPreset(key){ const p=TH.presets()[key]; if(!p)return;
  config=clone(p.cfg); buildIncome(); buildBudget(); recompute(); }

/* ============================ INIT ============================ */
function init(){
  seed=(Math.random()*1e9)|0;
  config=clone(TH.presets().current.cfg);
  state=TH.initialState();
  best=loadBest();
  buildMeters(); buildIncome(); buildBudget();
  $$('.tab-btn').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  $('#simulate').addEventListener('click',doSimulate);
  updateTermCounter(); recompute();
  if(!safeGet('taxhaven.seen')) showOnboarding();
}
function safeGet(k){ try{return localStorage.getItem(k);}catch(e){return '1';} }
document.addEventListener('DOMContentLoaded',init);
})();
