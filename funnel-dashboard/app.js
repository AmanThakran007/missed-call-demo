const source='telemetry.json';
const REFRESH_MS=60000;
const funnelIds=[
'dpdp-buyer-outreach','b2b-appointment-setting','webscan-general-sme','webscan-healthcare',
'webscan-professional-services','webscan-agency-white-label','uk-resourcer-outreach',
'nurse-referral-uk','nurse-referral-us','nclex-growth-core','nclex-colleges','nclex-creators',
'nclex-recruiter-partnerships','bharatfare-supplier-outreach','bharatfare-agent-partnerships'
];

const schedules={
'dpdp-buyer-outreach':{hours:[16],minute:0},
'b2b-appointment-setting':{hours:[9],minute:45},
'webscan-general-sme':{hours:[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3],minute:4},
'webscan-healthcare':{hours:[11],minute:0},
'webscan-professional-services':{hours:[11],minute:15},
'webscan-agency-white-label':{hours:[11],minute:30},
'uk-resourcer-outreach':{hours:[9],minute:30},
'nurse-referral-uk':{hours:[11],minute:45},
'nurse-referral-us':{hours:[12],minute:0},
'nclex-growth-core':{hours:[10],minute:15},
'nclex-colleges':{hours:[12],minute:15},
'nclex-creators':{hours:[12],minute:30},
'nclex-recruiter-partnerships':{hours:[12],minute:45},
'bharatfare-supplier-outreach':{hours:[10],minute:30},
'bharatfare-agent-partnerships':{hours:[10],minute:45}
};

function money(v){
  if(v===null||v===undefined)return '—';
  return '£'+Number(v).toFixed(2).replace(/\.00$/,'');
}
function val(v){return (v===null||v===undefined||v==='')?'Awaiting first sync':v}
function set(id,v){const el=document.getElementById(id);if(el)el.textContent=v}
function londonParts(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d);
  return Object.fromEntries(parts.map(p=>[p.type,p.value]));
}
function londonDateAt(y,m,d,h,min){
  const guess=new Date(Date.UTC(y,m-1,d,h,min,0));
  const p=londonParts(guess);
  const localAsUTC=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,0);
  const targetAsUTC=Date.UTC(y,m-1,d,h,min,0);
  return new Date(guess.getTime()+(targetAsUTC-localAsUTC));
}
function nextScheduledRun(id){
  const s=schedules[id]; if(!s)return null;
  const now=new Date(); const p=londonParts(now);
  const y=+p.year,m=+p.month,d=+p.day;
  const candidates=[];
  for(let dayOffset=0;dayOffset<3;dayOffset++){
    const base=new Date(Date.UTC(y,m-1,d+dayOffset));
    const bp=londonParts(base);
    for(const h of s.hours){
      const dt=londonDateAt(+bp.year,+bp.month,+bp.day,h,s.minute);
      if(dt>now)candidates.push(dt);
    }
  }
  return candidates.sort((a,b)=>a-b)[0]||null;
}
function fmtTime(dt){
  if(!dt)return 'Awaiting schedule';
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(dt)+' UK';
}
function humanUntil(dt){
  if(!dt)return '—';
  const ms=dt-new Date();
  if(ms<=0)return 'due now';
  const mins=Math.ceil(ms/60000);
  if(mins<60)return 'in '+mins+' min';
  const hrs=Math.floor(mins/60), rem=mins%60;
  if(hrs<24)return 'in '+hrs+'h'+(rem?' '+rem+'m':'');
  const days=Math.floor(hrs/24);return 'in '+days+'d';
}
async function loadJson(url){
  try{
    const r=await fetch(url+'?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok)return null;
    return await r.json();
  }catch(e){return null}
}
async function buildData(){
  const base=(await loadJson(source))||{activeFunnels:15,funnels:{},ads:{}};
  const parts=await Promise.all(funnelIds.map(id=>loadJson('telemetry/funnels/'+id+'.json')));
  parts.forEach((p,i)=>{if(p){const id=funnelIds[i];base.funnels[id]=Object.assign({},base.funnels[id]||{},p)}});
  const ad=await loadJson('telemetry/ads/webscan-agency-white-label-36-test.json');
  if(ad){base.ads=base.ads||{};base.ads['webscan-agency-white-label-36-test']=Object.assign({},base.ads['webscan-agency-white-label-36-test']||{},ad)}
  return base;
}
function drawAds(data){
  const ad=data.ads&&data.ads['webscan-agency-white-label-36-test']; if(!ad)return;
  set('adCampaignName',ad.campaignName);set('adStatus',ad.status);set('adDelivery',ad.deliveryStatus);
  set('adBudget',money(ad.lifetimeBudgetGbp));set('adSpend',money(ad.spendGbp));set('adImpressions',ad.impressions);
  set('adClicks',ad.clicks);set('adCtr',ad.ctr==null?'—':ad.ctr+'%');set('adCpc',ad.cpcGbp==null?'—':money(ad.cpcGbp));
  set('adReview',ad.reviewStatus||'—');set('adMilestone',(ad.milestone||'—').replaceAll('_',' '));set('adDeliveryBadge',ad.deliveryStatus||'—');
  set('lastUpdated','Last updated: '+(ad.lastChecked||data.generatedAt||'—'));
}
function drawSummary(data){
  const fs=Object.values(data.funnels||{});
  const keys=['firstEmailsSent','humanReplies','positiveReplies','callsDemosRequested','customersWon','revenueGbp'];
  const sums={};keys.forEach(k=>sums[k]=0);let has=false;
  fs.forEach(f=>keys.forEach(k=>{if(typeof f[k]==='number'){sums[k]+=f[k];has=true}}));
  const rows=[
    ['Active Funnels',data.activeFunnels||fs.length],
    ['Data Freshness',fs.some(f=>f.freshness==='LIVE')?'Partially live':'Awaiting first sync'],
    ['First Emails Sent',has?sums.firstEmailsSent:'Awaiting first sync'],
    ['Human Replies',has?sums.humanReplies:'Awaiting first sync'],
    ['Positive Replies',has?sums.positiveReplies:'Awaiting first sync'],
    ['Calls / Demos',has?sums.callsDemosRequested:'Awaiting first sync'],
    ['Customers Won',has?sums.customersWon:'Awaiting first sync'],
    ['Revenue (£)',has?money(sums.revenueGbp):'Awaiting first sync']
  ];
  document.getElementById('summaryGrid').innerHTML=rows.map(r=>'<div class="summary-card"><span>'+r[0]+'</span><strong>'+r[1]+'</strong></div>').join('');
}
function statusClass(fresh){
  if(fresh==='LIVE')return 'live-status';
  if(fresh==='STALE'||fresh==='TELEMETRY_SYNC_BLOCKED')return 'stale-status';
  return '';
}
function drawFunnels(data){
  const root=document.getElementById('funnels');root.innerHTML='';
  const labels=[
    ['Prospects Researched','prospectsResearched'],['First Emails Sent','firstEmailsSent'],['Follow-Ups Sent','followUpsSent'],
    ['Human Replies','humanReplies'],['Positive Replies','positiveReplies'],['Calls / Demos Requested','callsDemosRequested'],
    ['Customers Won','customersWon'],['Revenue (£)','revenueGbp'],['Last Automation Run','lastRun'],
    ['Data Freshness','freshness'],['Current Blocker','blocker']
  ];
  funnelIds.forEach(id=>{
    const f=data.funnels&&data.funnels[id];if(!f)return;
    const card=document.createElement('article');card.className='funnel-card';
    const rawFresh=f.freshness||'AWAITING_FIRST_SYNC';const fresh=rawFresh.replaceAll('_',' ');
    const next=nextScheduledRun(id); const nextText=fmtTime(next)+' · '+humanUntil(next);
    let rows='<div class="row next-sync-row"><span>Expected next sync</span><strong>'+nextText+'</strong></div>';
    labels.forEach(pair=>{
      let v=f[pair[1]]; if(pair[1]==='revenueGbp'&&typeof v==='number')v=money(v);
      rows+='<div class="row"><span>'+pair[0]+'</span><strong>'+val(v)+'</strong></div>';
    });
    card.innerHTML='<div class="funnel-head"><div><div class="funnel-name">'+f.name+'</div><div class="category">'+f.category+'</div></div><span class="status '+statusClass(rawFresh)+'">'+fresh+'</span></div><div>'+rows+'</div>';
    root.appendChild(card);
  });
}
let nextRefreshAt=Date.now()+REFRESH_MS;
function updateCountdowns(){
  const left=Math.max(0,nextRefreshAt-Date.now());
  set('refreshCountdown',Math.ceil(left/1000)+'s');
  const adNext=nextScheduledRun('webscan-general-sme');
  set('nextAdsSync',fmtTime(adNext)+' · '+humanUntil(adNext));
  set('adExpectedSync',humanUntil(adNext));
  if(left<=0)nextRefreshAt=Date.now()+REFRESH_MS;
}
async function refresh(){
  try{
    const data=await buildData();
    set('activeFunnels',(data.activeFunnels||15)+' Active Funnels');
    drawAds(data);drawSummary(data);drawFunnels(data);
    nextRefreshAt=Date.now()+REFRESH_MS;
  }catch(e){
    console.error(e);
    set('lastUpdated','Telemetry refresh failed — retrying automatically');
  }
}
refresh();
setInterval(refresh,REFRESH_MS);
setInterval(updateCountdowns,1000);
updateCountdowns();