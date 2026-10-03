const source='telemetry.json';
const funnelIds=[
'dpdp-buyer-outreach','b2b-appointment-setting','webscan-general-sme','webscan-healthcare',
'webscan-professional-services','webscan-agency-white-label','uk-resourcer-outreach',
'nurse-referral-uk','nurse-referral-us','nclex-growth-core','nclex-colleges','nclex-creators',
'nclex-recruiter-partnerships','bharatfare-supplier-outreach','bharatfare-agent-partnerships'
];

function money(v){
  if(v===null||v===undefined)return '—';
  return '£'+Number(v).toFixed(2).replace(/\.00$/,'');
}
function val(v){
  return (v===null||v===undefined||v==='')?'Awaiting first sync':v;
}
function set(id,v){
  const el=document.getElementById(id);
  if(el)el.textContent=v;
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
  parts.forEach((p,i)=>{
    if(!p)return;
    const id=funnelIds[i];
    base.funnels[id]=Object.assign({},base.funnels[id]||{},p);
  });
  const ad=await loadJson('telemetry/ads/webscan-agency-white-label-36-test.json');
  if(ad){
    base.ads=base.ads||{};
    base.ads['webscan-agency-white-label-36-test']=Object.assign({},base.ads['webscan-agency-white-label-36-test']||{},ad);
  }
  return base;
}
function drawAds(data){
  const ad=data.ads&&data.ads['webscan-agency-white-label-36-test'];
  if(!ad)return;
  set('adCampaignName',ad.campaignName);
  set('adStatus',ad.status);
  set('adDelivery',ad.deliveryStatus);
  set('adBudget',money(ad.lifetimeBudgetGbp));
  set('adSpend',money(ad.spendGbp));
  set('adImpressions',ad.impressions);
  set('adClicks',ad.clicks);
  set('adCtr',ad.ctr==null?'—':ad.ctr+'%');
  set('adCpc',ad.cpcGbp==null?'—':money(ad.cpcGbp));
  set('adReview',ad.reviewStatus||'—');
  set('adMilestone',(ad.milestone||'—').replaceAll('_',' '));
  set('adDeliveryBadge',ad.deliveryStatus||'—');
  set('lastUpdated','Last updated: '+(ad.lastChecked||data.generatedAt||'—'));
}
function drawSummary(data){
  const fs=Object.values(data.funnels||{});
  const keys=['firstEmailsSent','humanReplies','positiveReplies','callsDemosRequested','customersWon','revenueGbp'];
  const sums={};keys.forEach(k=>sums[k]=0);
  let has=false;
  fs.forEach(f=>keys.forEach(k=>{
    if(typeof f[k]==='number'){sums[k]+=f[k];has=true}
  }));
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
function drawFunnels(data){
  const root=document.getElementById('funnels');root.innerHTML='';
  const labels=[
    ['Prospects Researched','prospectsResearched'],
    ['First Emails Sent','firstEmailsSent'],
    ['Follow-Ups Sent','followUpsSent'],
    ['Human Replies','humanReplies'],
    ['Positive Replies','positiveReplies'],
    ['Calls / Demos Requested','callsDemosRequested'],
    ['Customers Won','customersWon'],
    ['Revenue (£)','revenueGbp'],
    ['Last Automation Run','lastRun'],
    ['Next Scheduled Run','nextRun'],
    ['Data Freshness','freshness'],
    ['Current Blocker','blocker']
  ];
  funnelIds.forEach(id=>{
    const f=data.funnels&&data.funnels[id];
    if(!f)return;
    const card=document.createElement('article');
    card.className='funnel-card';
    const fresh=(f.freshness||'AWAITING_FIRST_SYNC').replaceAll('_',' ');
    let rows='';
    labels.forEach(pair=>{
      let v=f[pair[1]];
      if(pair[1]==='revenueGbp'&&typeof v==='number')v=money(v);
      rows+='<div class="row"><span>'+pair[0]+'</span><strong>'+val(v)+'</strong></div>';
    });
    card.innerHTML='<div class="funnel-head"><div><div class="funnel-name">'+f.name+'</div><div class="category">'+f.category+'</div></div><span class="status">'+fresh+'</span></div><div>'+rows+'</div>';
    root.appendChild(card);
  });
}
async function refresh(){
  try{
    const data=await buildData();
    set('activeFunnels',(data.activeFunnels||15)+' Active Funnels');
    drawAds(data);drawSummary(data);drawFunnels(data);
  }catch(e){
    console.error(e);
    set('lastUpdated','Telemetry refresh failed — retrying automatically');
  }
}
refresh();
setInterval(refresh,60000);