const source='telemetry.json';
const REFRESH_MS=60000;
const funnelIds=['dpdp-buyer-outreach','b2b-appointment-setting','webscan-general-sme','webscan-healthcare','webscan-professional-services','webscan-agency-white-label','uk-resourcer-outreach','nurse-referral-uk','nurse-referral-us','nclex-growth-core','nclex-colleges','nclex-creators','nclex-recruiter-partnerships','bharatfare-supplier-outreach','bharatfare-agent-partnerships'];
const schedules={'dpdp-buyer-outreach':{hours:[16],minute:0},'b2b-appointment-setting':{hours:[9],minute:45},'webscan-general-sme':{hours:[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3],minute:4},'webscan-healthcare':{hours:[11],minute:0},'webscan-professional-services':{hours:[11],minute:15},'webscan-agency-white-label':{hours:[11],minute:30},'uk-resourcer-outreach':{hours:[9],minute:30},'nurse-referral-uk':{hours:[11],minute:45},'nurse-referral-us':{hours:[12],minute:0},'nclex-growth-core':{hours:[10],minute:15},'nclex-colleges':{hours:[12],minute:15},'nclex-creators':{hours:[12],minute:30},'nclex-recruiter-partnerships':{hours:[12],minute:45},'bharatfare-supplier-outreach':{hours:[10],minute:30},'bharatfare-agent-partnerships':{hours:[10],minute:45}};

function money(v){if(v===null||v===undefined)return '—';return '£'+Number(v).toFixed(2).replace(/\.00$/,'')}
function val(v){return (v===null||v===undefined||v==='')?'Awaiting first sync':v}
function set(id,v){const el=document.getElementById(id);if(el)el.textContent=v}
function londonParts(d=new Date()){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d);return Object.fromEntries(parts.map(p=>[p.type,p.value]))}
function londonDateAt(y,m,d,h,min){const guess=new Date(Date.UTC(y,m-1,d,h,min,0));const p=londonParts(guess);const localAsUTC=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,0);const targetAsUTC=Date.UTC(y,m-1,d,h,min,0);return new Date(guess.getTime()+(targetAsUTC-localAsUTC))}
function nextScheduledRun(id){const s=schedules[id];if(!s)return null;const now=new Date(),p=londonParts(now),y=+p.year,m=+p.month,d=+p.day,candidates=[];for(let dayOffset=0;dayOffset<3;dayOffset++){const base=new Date(Date.UTC(y,m-1,d+dayOffset));const bp=londonParts(base);for(const h of s.hours){const dt=londonDateAt(+bp.year,+bp.month,+bp.day,h,s.minute);if(dt>now)candidates.push(dt)}}return candidates.sort((a,b)=>a-b)[0]||null}
function fmtTime(dt){if(!dt)return 'Awaiting schedule';return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(dt)+' UK'}
function humanUntil(dt){if(!dt)return '—';const ms=dt-new Date();if(ms<=0)return 'due now';const mins=Math.ceil(ms/60000);if(mins<60)return 'in '+mins+' min';const hrs=Math.floor(mins/60),rem=mins%60;if(hrs<24)return 'in '+hrs+'h'+(rem?' '+rem+'m':'');return 'in '+Math.floor(hrs/24)+'d'}
async function loadJson(url){try{const r=await fetch(url+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch(e){return null}}
async function buildData(){
  const base=(await loadJson(source))||{activeFunnels:15,funnels:{},ads:{}};
  base.funnels=base.funnels||{};
  const parts=await Promise.all(funnelIds.map(id=>loadJson('telemetry/funnels/'+id+'.json')));
  parts.forEach((p,i)=>{
    const id=funnelIds[i];
    if(p){
      base.funnels[id]=Object.assign({},base.funnels[id]||{},p);
      base.funnels[id].freshness=HourlyEvidence.freshness(p);
    }else if(base.funnels[id]){
      base.funnels[id].freshness='TELEMETRY_SYNC_BLOCKED';
      base.funnels[id].blocker='Current source fetch failed. Displayed metrics are a saved snapshot. '+(base.funnels[id].blocker||'');
    }
  });
  const ad=await loadJson('telemetry/ads/webscan-agency-white-label-36-test.json');
  if(ad){base.ads=base.ads||{};base.ads['webscan-agency-white-label-36-test']=Object.assign({},base.ads['webscan-agency-white-label-36-test']||{},ad)}
  return base;
}
function aggregate(data){const fs=Object.values(data.funnels||{});const sums={prospectsResearched:0,firstEmailsSent:0,followUpsSent:0,humanReplies:0,positiveReplies:0,callsDemosRequested:0,customersWon:0,revenueGbp:0};for(const f of fs){for(const k in sums)if(typeof f[k]==='number')sums[k]+=f[k]}return {fs,sums}}
function drawGlance(data){const {fs,sums}=aggregate(data);const live=fs.filter(f=>f.freshness==='LIVE').length, waiting=fs.filter(f=>!f.freshness||f.freshness==='AWAITING_FIRST_SYNC').length;const snap=data.ledgerSnapshot||{};const sentToday=Number.isFinite(Number(snap.sentToday))?Number(snap.sentToday):null;const sentAll=Number.isFinite(Number(snap.sentAll))?Number(snap.sentAll):sums.firstEmailsSent;const items=[['⚡','Fresh source records',live],['⏳','Awaiting Sync',waiting],['📨','Sent Today',sentToday==null?'—':sentToday],['✉️','First Emails (All time)',sentAll||'—'],['💬','Human Replies',sums.humanReplies||'—'],['🤝','Calls / Demos',sums.callsDemosRequested||'—'],['£','Revenue',sums.revenueGbp?money(sums.revenueGbp):'—']];document.getElementById('glanceStrip').innerHTML=items.map(x=>'<div class="glance-card"><div class="glance-icon">'+x[0]+'</div><span>'+x[1]+'</span><strong>'+x[2]+'</strong></div>').join('')}
function drawMilestones(data){const {sums}=aggregate(data);const ad=data.ads&&data.ads['webscan-agency-white-label-36-test']||{};const ms=[['Campaign created',true,'£36 WebScan test configured'],['Ad eligible',ad.deliveryStatus==='ELIGIBLE'||ad.status==='ACTIVE','Campaign can serve'],['First impression',Number(ad.impressions)>0,'Waiting for first served impression'],['First click',Number(ad.clicks)>0,'Waiting for first click'],['First positive reply',sums.positiveReplies>0,'Across all outreach funnels'],['First call / demo',sums.callsDemosRequested>0,'Across all outreach funnels'],['First customer',sums.customersWon>0,'Confirmed revenue-generating conversion'],['First £1 revenue',sums.revenueGbp>0,'Confirmed attributable revenue']];const done=ms.filter(x=>x[1]).length;set('milestoneCount',done+'/'+ms.length);const circumference=195;const ring=document.getElementById('milestoneRing');if(ring)ring.style.strokeDashoffset=String(circumference-(circumference*done/ms.length));document.getElementById('milestones').innerHTML=ms.map(x=>'<div class="milestone '+(x[1]?'done':'waiting')+'"><div class="milestone-icon">'+(x[1]?'✓':'•')+'</div><div><div class="milestone-title">'+x[0]+'</div><div class="milestone-sub">'+x[2]+'</div></div><div class="milestone-state">'+(x[1]?'Done':'Waiting')+'</div></div>').join('')}
function drawAttention(data){const {fs,sums}=aggregate(data);const items=[];const sendBlocked=fs.filter(f=>f.blocker);if(sendBlocked.length)items.push(['Recorded campaign blockers',sendBlocked.length+' funnels have unresolved blocker fields; inspect their records']);const blocked=fs.filter(f=>f.freshness==='TELEMETRY_SYNC_BLOCKED');const stale=fs.filter(f=>f.freshness==='STALE');const waiting=fs.filter(f=>!f.freshness||f.freshness==='AWAITING_FIRST_SYNC');if(blocked.length)items.push(['Telemetry blocked',blocked.length+' funnel'+(blocked.length>1?'s':'')+' need a successful write']);if(stale.length)items.push(['Stale telemetry',stale.length+' funnel'+(stale.length>1?'s are':' is')+' overdue']);if(waiting.length)items.push(['Awaiting first sync',waiting.length+' funnel'+(waiting.length>1?'s have':' has')+' not reported yet']);const ad=data.ads&&data.ads['webscan-agency-white-label-36-test']||{};if(!(Number(ad.impressions)>0))items.push(['Ad waiting for first impression','Campaign is eligible but has not served yet']);if(!sums.positiveReplies)items.push(['No positive reply recorded yet','Keep watching outreach funnels for first commercial signal']);document.getElementById('attentionList').innerHTML=(items.length?items:[['No telemetry alerts','Sending and reply status require separate evidence']]).slice(0,5).map(x=>'<div class="attention-item"><strong>'+x[0]+'</strong><span>'+x[1]+'</span></div>').join('')}
function drawCategoryGrid(data){const groups={};for(const f of Object.values(data.funnels||{})){const c=f.category||'Other';if(!groups[c])groups[c]=[];groups[c].push(f)}document.getElementById('categoryGrid').innerHTML=Object.entries(groups).map(([name,arr])=>{const live=arr.filter(f=>f.freshness==='LIVE').length;const replies=arr.reduce((a,f)=>a+(Number(f.humanReplies)||0),0);const calls=arr.reduce((a,f)=>a+(Number(f.callsDemosRequested)||0),0);const revenue=arr.reduce((a,f)=>a+(Number(f.revenueGbp)||0),0);const pct=Math.round((live/arr.length)*100);return '<div class="category-card"><div class="category-top"><div class="category-name">'+name+'</div><div class="category-count">'+arr.length+' funnel'+(arr.length>1?'s':'')+'</div></div><div class="health-bar"><div class="health-fill" style="width:'+pct+'%"></div></div><div class="category-stats"><div class="category-stat"><span>Live</span><strong>'+live+'/'+arr.length+'</strong></div><div class="category-stat"><span>Replies</span><strong>'+replies+'</strong></div><div class="category-stat"><span>Calls</span><strong>'+calls+'</strong></div></div>'+(revenue?'<div class="category-stat" style="margin-top:8px"><span>Revenue</span><strong>'+money(revenue)+'</strong></div>':'')+'</div>'}).join('')}
function drawTimeline(data){const events=[];const ad=data.ads&&data.ads['webscan-agency-white-label-36-test'];if(ad&&ad.lastChecked)events.push({t:new Date(ad.lastChecked),title:'Ads telemetry checked',sub:(ad.deliveryStatus||'Unknown')+' · '+(Number(ad.impressions)||0)+' impressions · '+money(Number(ad.spendGbp)||0)+' spend'});for(const f of Object.values(data.funnels||{})){if(f.lastRun){const d=new Date(f.lastRun);if(!isNaN(d))events.push({t:d,title:f.name+' ran',sub:(f.freshness||'').replaceAll('_',' ')})}}events.sort((a,b)=>b.t-a.t);document.getElementById('activityTimeline').innerHTML=(events.length?events.slice(0,8):[{t:null,title:'Waiting for first verified activity',sub:'Events will appear here after successful telemetry writes'}]).map(e=>'<div class="timeline-item"><div class="timeline-time">'+(e.t?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(e.t)+' UK':'—')+'</div><div class="timeline-title">'+e.title+'</div><div class="timeline-sub">'+e.sub+'</div></div>').join('')}
function drawAds(data){const ad=data.ads&&data.ads['webscan-agency-white-label-36-test'];if(!ad)return;set('adCampaignName',ad.campaignName);set('adStatus',ad.status);set('adDelivery',ad.deliveryStatus);set('adBudget',money(ad.lifetimeBudgetGbp));set('adSpend',money(ad.spendGbp));set('adImpressions',ad.impressions);set('adClicks',ad.clicks);set('adCtr',ad.ctr==null?'—':ad.ctr+'%');set('adCpc',ad.cpcGbp==null?'—':money(ad.cpcGbp));set('adReview',ad.reviewStatus||'—');set('adMilestone',(ad.milestone||'—').replaceAll('_',' '));set('adDeliveryBadge',ad.deliveryStatus||'—');set('lastUpdated','Last updated: '+(ad.lastChecked||data.generatedAt||'—'))}
function drawSummary(data){const {fs,sums}=aggregate(data);const has=Object.values(sums).some(v=>v>0);const rows=[['Tracked Funnel Records',fs.length],['Data Freshness',fs.some(f=>f.freshness==='LIVE')?'Partially live':'Awaiting first sync'],['First Emails Sent',has?sums.firstEmailsSent:'Awaiting first sync'],['Human Replies',has?sums.humanReplies:'Awaiting first sync'],['Positive Replies',has?sums.positiveReplies:'Awaiting first sync'],['Calls / Demos',has?sums.callsDemosRequested:'Awaiting first sync'],['Customers Won',has?sums.customersWon:'Awaiting first sync'],['Revenue (£)',has?money(sums.revenueGbp):'Awaiting first sync']];document.getElementById('summaryGrid').innerHTML=rows.map(r=>'<div class="summary-card"><span>'+r[0]+'</span><strong>'+r[1]+'</strong></div>').join('')}
function statusClass(fresh){if(fresh==='LIVE')return 'live-status';if(fresh==='STALE'||fresh==='TELEMETRY_SYNC_BLOCKED')return 'stale-status';return ''}
function drawFunnels(data){
  const root=document.getElementById('funnels');root.innerHTML='';
  const labels=[
    ['Prospects Researched','prospectsResearched'],['First Emails Sent','firstEmailsSent'],['Follow-Ups Sent','followUpsSent'],
    ['Human Replies','humanReplies'],['Positive Replies','positiveReplies'],['Calls / Demos Requested','callsDemosRequested'],
    ['Customers Won','customersWon'],['Revenue (£)','revenueGbp'],['Last reported source check','lastRun'],
    ['Data Freshness','freshness'],['Current Blocker','blocker']
  ];
  const ordered=funnelIds
    .map(id=>({id,f:data.funnels&&data.funnels[id],next:nextScheduledRun(id)}))
    .filter(x=>x.f)
    .sort((a,b)=>{
      if(!a.next&&!b.next)return 0;
      if(!a.next)return 1;
      if(!b.next)return -1;
      return a.next-b.next;
    });
  ordered.forEach((x,index)=>{
    const id=x.id,f=x.f,next=x.next;
    const card=document.createElement('article');card.className='funnel-card';
    const rawFresh=f.freshness||'AWAITING_FIRST_SYNC',fresh=rawFresh.replaceAll('_',' ');
    const nextText='See Funnel Health for scheduler evidence';
    let rows='<div class="row next-sync-row"><span>Automation schedule</span><strong>'+nextText+'</strong></div>';
    labels.forEach(pair=>{
      let v=f[pair[1]];
      if(pair[1]==='blocker'&&!v)v='None recorded (not a health certification)';
      if(pair[1]==='lastRun'&&!v)v=f.lastChecked||'Not recorded';
      if(pair[1]==='revenueGbp'&&typeof v==='number')v=money(v);
      rows+='<div class="row"><span>'+pair[0]+'</span><strong>'+val(v)+'</strong></div>';
    });
    card.innerHTML='<div class="funnel-head"><div><div class="funnel-name">'+f.name+'</div><div class="category">'+f.category+'</div></div><span class="status '+statusClass(rawFresh)+'">'+fresh+'</span></div><div>'+rows+'</div>';
    root.appendChild(card);
  });
}
let nextRefreshAt=Date.now()+REFRESH_MS;
function updateCountdowns(){const left=Math.max(0,nextRefreshAt-Date.now());set('refreshCountdown',Math.ceil(left/1000)+'s');const adNext=nextScheduledRun('webscan-general-sme');set('nextAdsSync',fmtTime(adNext)+' · '+humanUntil(adNext));set('adExpectedSync',humanUntil(adNext));if(left<=0)nextRefreshAt=Date.now()+REFRESH_MS}
async function refresh(){try{const data=await buildData();set('activeFunnels',(data.activeFunnels||15)+' Active Funnels');drawGlance(data);drawMilestones(data);drawAttention(data);drawAds(data);drawCategoryGrid(data);drawSummary(data);drawTimeline(data);drawFunnels(data);nextRefreshAt=Date.now()+REFRESH_MS}catch(e){console.error(e);set('lastUpdated','Telemetry refresh failed — retrying automatically')}}
setInterval(updateCountdowns,1000);updateCountdowns();

async function loadHistory(){
  return (await loadJson('history.json')) || {points:[]};
}

function drawGoals(data){
  const {sums}=aggregate(data);
  const configs=[
    ['Positive Replies',sums.positiveReplies,null],
    ['Calls / Demos',sums.callsDemosRequested,null],
    ['Customers Won',sums.customersWon,null],
    ['Revenue (£)',sums.revenueGbp,null]
  ];
  document.getElementById('goalsGrid').innerHTML=configs.map(([label,current,target])=>{
    const pct=target&&target>0?Math.min(100,Math.round((current/target)*100)):0;
    const shown=label==='Revenue (£)'?money(current):current;
    return '<div class="goal-card"><span>'+label+'</span><strong>'+shown+'</strong><div class="goal-progress"><i style="width:'+pct+'%"></i></div><div class="goal-foot"><span>Actual</span><span>'+(target==null?'Target not set':target)+'</span></div></div>';
  }).join('');
}

function drawConversionFunnel(data){
  const {sums}=aggregate(data);
  const rows=[
    ['Prospects',sums.prospectsResearched],
    ['First emails',sums.firstEmailsSent],
    ['Human replies',sums.humanReplies],
    ['Positive replies',sums.positiveReplies],
    ['Calls / demos',sums.callsDemosRequested],
    ['Customers',sums.customersWon]
  ];
  const max=Math.max(1,...rows.map(r=>Number(r[1])||0));
  document.getElementById('conversionFunnel').innerHTML=rows.map((r,i)=>{
    const n=Number(r[1])||0;
    const pct=Math.round((n/max)*100);
    const prev=i>0?(Number(rows[i-1][1])||0):null;
    const rate=prev&&prev>0?Math.round((n/prev)*100)+'%':'—';
    return '<div class="funnel-step"><div class="funnel-step-label">'+r[0]+'</div><div class="funnel-bar"><div class="funnel-bar-fill" style="width:'+pct+'%"></div></div><strong>'+n+(i>0?' · '+rate:'')+'</strong></div>';
  }).join('');
}

function drawReplyCentre(data){
  const {fs}=aggregate(data);
  const items=[];
  for(const f of fs){
    const replies=Number(f.humanReplies)||0;
    const pos=Number(f.positiveReplies)||0;
    const calls=Number(f.callsDemosRequested)||0;
    if(calls>0)items.push([f.name,calls+' call/demo request'+(calls>1?'s':'')]);
    else if(pos>0)items.push([f.name,pos+' positive repl'+(pos>1?'ies':'y')]);
    else if(replies>0)items.push([f.name,replies+' human repl'+(replies>1?'ies':'y')]);
    if(f.freshness==='TELEMETRY_SYNC_BLOCKED')items.push([f.name,'Telemetry sync blocked']);
  }
  document.getElementById('replyCentre').innerHTML=(items.length?items.slice(0,8):[['No reply action yet','Waiting for verified human replies or calls']]).map(x=>'<div class="reply-item"><strong>'+x[0]+'</strong><span>'+x[1]+'</span></div>').join('');
}

function buildPriorities(data){
  const {fs,sums}=aggregate(data);
  const out=[];
  const blocked=fs.filter(f=>f.freshness==='TELEMETRY_SYNC_BLOCKED');
  if(blocked.length)out.push(['Fix blocked telemetry',blocked.length+' funnel'+(blocked.length>1?'s':'')+' cannot report live data']);
  const positive=fs.filter(f=>(Number(f.positiveReplies)||0)>0 && !(Number(f.callsDemosRequested)||0));
  if(positive.length)out.push(['Follow positive replies',positive.length+' funnel'+(positive.length>1?'s have':' has')+' interest but no call yet']);
  const calls=fs.filter(f=>(Number(f.callsDemosRequested)||0)>0 && !(Number(f.customersWon)||0));
  if(calls.length)out.push(['Convert active calls',calls.length+' funnel'+(calls.length>1?'s have':' has')+' calls but no customer yet']);
  const ad=data.ads&&data.ads['webscan-agency-white-label-36-test']||{};
  if(!(Number(ad.impressions)>0))out.push(['Watch first ad delivery','Campaign is eligible; first impression is still pending']);
  const waiting=fs.filter(f=>!f.freshness||f.freshness==='AWAITING_FIRST_SYNC');
  if(waiting.length)out.push(['Get first telemetry sync',waiting.length+' funnel'+(waiting.length>1?'s are':' is')+' still waiting']);
  if(!sums.positiveReplies)out.push(['Generate first positive reply','No verified positive commercial reply recorded yet']);
  return out.slice(0,3);
}
function drawPriorities(data){
  const items=buildPriorities(data);
  document.getElementById('priorityList').innerHTML=(items.length?items:[['Review operations evidence','Check queue readiness, open replies and sending blockers above']]).map((x,i)=>'<div class="priority-item"><strong><span class="priority-num">'+(i+1)+'</span>'+x[0]+'</strong><span>'+x[1]+'</span></div>').join('');
}

function linePath(points,width,height,key){
  const vals=points.map(p=>Number(p[key])||0);
  const max=Math.max(1,...vals);
  return points.map((p,i)=>{
    const x=points.length===1?width/2:(i/(points.length-1))*width;
    const y=height-(vals[i]/max)*(height-18)-9;
    return (i===0?'M':'L')+x.toFixed(1)+' '+y.toFixed(1);
  }).join(' ');
}
function drawTrends(history){
  const panel=document.getElementById('trendPanel');
  const pts=(history&&Array.isArray(history.points)?history.points:[]).slice(-30);
  if(pts.length<2){
    panel.innerHTML='<div class="trend-empty">Collecting history. Trend charts will appear after at least 2 verified snapshots.</div>';
    return;
  }
  const width=900,height=170;
  const p7=pts.slice(-7);
  const pathEmails=linePath(p7,width,height,'firstEmailsSent');
  const pathReplies=linePath(p7,width,height,'humanReplies');
  const pathRevenue=linePath(p7,width,height,'revenueGbp');
  panel.innerHTML='<div class="trend-head"><div><strong>Recent verified snapshots</strong><div class="sub">'+p7.length+' points shown</div></div><div class="trend-tabs"><span class="trend-tab active">7D</span><span class="trend-tab">30D</span></div></div><svg class="trend-chart" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none"><path d="'+pathEmails+'" fill="none" stroke="currentColor" stroke-width="3" opacity=".95"/><path d="'+pathReplies+'" fill="none" stroke="currentColor" stroke-width="2" opacity=".55"/><path d="'+pathRevenue+'" fill="none" stroke="currentColor" stroke-width="2" opacity=".3"/></svg><div class="trend-legend"><span>Primary line: First emails</span><span>Secondary: Human replies</span><span>Faint: Revenue</span></div>';
}


// Public dashboard: aggregate operational evidence only, never contact records.
function inboxAliases(s){return Object.keys(s?.sendingPolicy?.configuredDailyCapsByMailbox||{});}
function knownCount(n){return Number.isInteger(n)&&n>=0}
function sumKnown(rows,key){return rows.every(r=>knownCount(r[key]))?rows.reduce((n,r)=>n+r[key],0):null}
function shown(n){return knownCount(n)?String(n):'Unverified'}
function ukToday(){const p=londonParts();return p.year+'-'+p.month+'-'+p.day}
function snapshotUsable(s){if(!s||!Array.isArray(s.rows)||!s.rows.length)return false;const names=s.rows.map(r=>r.mailbox);return names.every(n=>typeof n==='string'&&n.length>0)&&new Set(names).size===names.length;}
function mailboxFresh(s,r){return (r.date||s.date)===ukToday()&&r.sourceRead==='VERIFIED'&&evidenceRecent(r.checkedAt||s.checkedAt);}
function snapshotFresh(s){const age=Date.now()-Date.parse(s?.checkedAt);return Number.isFinite(age)&&age>=-300000&&age<=5400000&&s.date===ukToday()&&s.status==='SOURCE_RECONCILED'&&s.rows.every(r=>mailboxFresh(s,r))&&inboxAliases(s).every(a=>s.rows.some(r=>r.mailbox===a))}
function progressFor(s,r){
 const outbound=knownCount(r.webscanFirstTouchesToday)&&knownCount(r.webscanFollowUpsToday)?r.webscanFirstTouchesToday+r.webscanFollowUpsToday:null;
 const active=ukToday()>=s.effectiveDate;
 const remaining=active&&mailboxFresh(s,r)&&knownCount(outbound)&&knownCount(r.configuredDailyCap)?Math.max(0,r.configuredDailyCap-outbound):null;
 const guard=s.sendingPolicy?.allMailLoadGuard??120; // Fixed all-mail load guard; independent of WebScan quota.
 const headroom=mailboxFresh(s,r)&&knownCount(guard)&&knownCount(r.allSentToday)&&knownCount(r.allSentRolling24h)?Math.max(0,Math.min(guard-r.allSentToday,guard-r.allSentRolling24h)):null;
 return {outbound,remaining,headroom,active};
}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function noteAt(root,text){root.appendChild(node('p',text,'ops-note'))}
function opsTable(root,headers,rows){const wrap=node('div',undefined,'ops-scroll');const table=node('table',undefined,'ops-table');const tr=table.createTHead().insertRow();headers.forEach(h=>{const th=node('th',h);th.scope='col';tr.appendChild(th)});const body=table.createTBody();rows.forEach(row=>{const tr=body.insertRow();row.forEach(v=>tr.appendChild(node('td',v)))});wrap.appendChild(table);root.appendChild(wrap)}
function drawWebscanMailboxes(s){
 const host=document.getElementById('webscanMailboxes');host.replaceChildren();
 if(!snapshotUsable(s)){noteAt(host,'Inbox telemetry unavailable. Daily sent and remaining counts will appear after a successful source check.');return}
 set('webscanMailboxTitle','Daily email counters · '+s.rows.length+' inboxes');
 const fresh=snapshotFresh(s);noteAt(host,(fresh?'SOURCE CHECKED':'STALE / PARTIAL SNAPSHOT')+' · '+s.checkedAt+' · UK date '+s.date+'. Sent records do not prove delivery.');
 const cards=node('div',undefined,'ops-cards');host.appendChild(cards);
 const countRows=s.rows.map(r=>progressFor(s,r));
 const complete=snapshotFresh(s)&&countRows.every(p=>knownCount(p.outbound)&&knownCount(p.remaining));
 const states=[['Outreach sent today',complete?countRows.reduce((n,p)=>n+p.outbound,0):'Unverified'],['Left today',complete?countRows.reduce((n,p)=>n+p.remaining,0):'Unverified'],['Daily limit',shown(s.sendingPolicy?.totalCap)],['Automation',s.automation?shown(s.automation.enabledWebscanTasks)+' WebScan tasks enabled':'Task status unverified'],['Data sync',fresh?'Source reconciled; JSON loaded':'Needs a fresh complete source check'],['Sending',s.verification?.futureScheduledSending==='PASSED'?'Verified by recorded send checks':'Sending not yet verified']];
 states.forEach(([title,value])=>{const card=node('div',undefined,'ops-card');card.append(node('span',title),node('strong',value));if(title==='Automation'&&s.automation)card.appendChild(node('small','Checked '+s.automation.checkedAt));cards.appendChild(card)});
 const all=sumKnown(s.rows,'allSentToday'),first=sumKnown(s.rows,'webscanFirstTouchesToday'),follow=sumKnown(s.rows,'webscanFollowUpsToday'),inbound=sumKnown(s.rows,'webscanInboundMessagesToday');
 const total=[first,follow,inbound].every(knownCount)?first+follow+inbound:null;
 noteAt(host,shown(all)+' all-campaign emails · '+shown(total)+' WebScan emails ('+shown(first)+' first touches + '+shown(follow)+' cold follow-ups + '+shown(inbound)+' inbound responses).');
 opsTable(host,['Inbox','All emails sent today','Outreach sent today','Daily limit','Left today','Load headroom','Volume policy'],s.rows.map(r=>{const p=progressFor(s,r);return [r.mailbox,mailboxFresh(s,r)?shown(r.allSentToday):'Unverified',mailboxFresh(s,r)?shown(p.outbound):'Unverified',shown(r.configuredDailyCap),p.active?shown(p.remaining):'Starts '+s.effectiveDate,shown(p.headroom),s.sendingPolicy?.mode==='FIXED_CAP'?'Fixed ceiling':shown(r.qualifyingDaysAtStage)+' / 3 qualifying days']}));
 noteAt(host,'Quota includes first touches and cold follow-ups. Load headroom includes all campaigns today and over 24 hours. Both are arithmetic ceilings, not permission to send. '+(s.sendingPolicy?.mode==='FIXED_CAP'?'Fixed starting ceiling: '+(s.sendingPolicy.capPerInbox??(s.sendingPolicy.capPerInboxMin+'–'+s.sendingPolicy.capPerInboxMax))+' per inbox, '+s.sendingPolicy.totalCap+' across '+s.rows.length+' inboxes. No ramp.':'Stage progression: 25 → 30 → 40 → 50 per inbox; each increase needs three qualifying sending days.')+'');
 const counters=node('div',undefined,'ops-cards');
 s.rows.forEach(r=>{
 const card=node('div',undefined,'ops-card');card.appendChild(node('span',r.mailbox));
 const today=ukToday(),started=today>=s.effectiveDate,rd=r.date||s.date,checked=r.checkedAt||s.checkedAt;
 const current=mailboxFresh(s,r);
 const engagementCurrent=current&&evidenceRecent(Object.hasOwn(r,'engagementCheckedAt')?r.engagementCheckedAt:checked);
 const sent=knownCount(r.webscanFirstTouchesToday)&&knownCount(r.webscanFollowUpsToday)?r.webscanFirstTouchesToday+r.webscanFollowUpsToday:null;
 const remaining=current&&knownCount(sent)&&knownCount(r.configuredDailyCap)?Math.max(0,r.configuredDailyCap-sent):null;
 card.appendChild(node('strong',!started?shown(r.configuredDailyCap)+' available from '+s.effectiveDate:remaining===null?'Remaining unverified':shown(sent)+' sent · '+remaining+' left today'));
 card.appendChild(node('small',!started?'Daily allowance starts tomorrow':current?'Daily limit: '+r.configuredDailyCap+' · first touches + cold follow-ups':'Waiting for a current-day Gmail sync'));
 const bar=node('progress');bar.max=r.configuredDailyCap||50;bar.value=started&&current&&knownCount(sent)?Math.min(sent,bar.max):0;bar.setAttribute('aria-label',r.mailbox+' confirmed daily outbound sends');bar.style.cssText='width:100%;margin-top:12px;accent-color:var(--teal)';card.appendChild(bar);
 const stats=node('dl');stats.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;font-size:13px';
 const totalSent=knownCount(sent)&&knownCount(r.webscanInboundMessagesToday)?sent+r.webscanInboundMessagesToday:null;
 const metrics=[['All emails sent today',current?shown(r.allSentToday):'Unverified'],['WebScan sent today',current?shown(totalSent):'Unverified'],['Confirmed delivered','Not tracked'],['Bounces reported today',engagementCurrent?shown(r.webscanBouncesToday):'Unverified'],['Opened','Not tracked'],['Link clicks','Not tracked'],['Human replies today',engagementCurrent?shown(r.webscanHumanRepliesToday):'Unverified'],['Opt-outs today',engagementCurrent?shown(r.webscanOptOutsToday):'Unverified']];
 metrics.forEach(([label,value])=>{const dt=node('dt',label);dt.style.color='var(--muted)';const dd=node('dd',value);dd.style.cssText='margin:0;text-align:right;font-weight:700';stats.append(dt,dd)});card.appendChild(stats);
 card.appendChild(node('small','Last source sync: '+checked));counters.appendChild(card);
 });host.insertBefore(counters,cards);
 noteAt(host,'Delivery and engagement: Gmail Sent confirms sending only. No bounce does not prove delivery or inbox placement. Delivery, opens and clicks are not tracked by this setup. Bounce, reply and opt-out figures are observed WebScan events for the displayed UK date, and may relate to earlier sends; they are not delivery or conversion rates. Sent today includes inbound responses, which do not consume the cold-outreach allowance.');
 noteAt(host,'Remaining decreases only after confirmed WebScan first touches or cold follow-ups are synced. Drafts and failed attempts do not consume quota. Page refreshes every 60 seconds; Gmail sync may lag. Each London day needs a fresh count before remaining is shown.');
 const details=node('details');details.appendChild(node('summary','Sending blockers and shortfall reasons'));
 s.rows.forEach(r=>{const reasons=Array.isArray(r.skippedReasons)?r.skippedReasons:[];noteAt(details,r.mailbox+': '+(reasons.length?reasons.join('; '):'No per-inbox shortfall explanation recorded.'))});
 (s.blockers||[]).forEach(b=>noteAt(details,b));host.appendChild(details);
}
function drawWebscanOperations(s,data){
 const queue=document.getElementById('prospectQueue'),reply=document.getElementById('replyCentre');queue.replaceChildren();reply.replaceChildren();
 if(!snapshotUsable(s)){noteAt(queue,'Queue evidence unavailable.');noteAt(reply,'Reply evidence unavailable.');return}
 const filter=document.getElementById('opsInboxFilter'),previous=filter.value;
 filter.replaceChildren();const allOption=node('option','All '+s.rows.length+' inboxes');allOption.value='all';filter.appendChild(allOption);
 s.rows.forEach(r=>{const option=node('option',r.mailbox);option.value=r.mailbox;filter.appendChild(option)});
 filter.value=s.rows.some(r=>r.mailbox===previous)?previous:'all';
 const selected=filter.value;
 const rows=s.rows.filter(r=>selected==='all'||r.mailbox===selected);
 const freshEvidence=e=>snapshotFresh(s)&&e?.status==='VERIFIED'&&Number.isFinite(Date.parse(e.checkedAt))&&Math.abs(Date.parse(s.checkedAt)-Date.parse(e.checkedAt))<=7200000;
 noteAt(queue,'Ready means verified contact and business fit, all-inbox duplicate/suppression checks, one assigned sender and no unresolved sending block. Research totals alone do not qualify.');
 opsTable(queue,['Inbox','Ready','Awaiting verification','Blocked','Last queue check'],rows.map(r=>{const q=r.prospectQueue;const valid=freshEvidence(q);return [r.mailbox,valid?shown(q.ready):'Unverified',valid?shown(q.awaitingVerification):'Unverified',valid?shown(q.blocked):'Unverified',q?.checkedAt||'Not recorded']}));
 const researched=Object.entries(data.funnels||{}).filter(([id])=>id.startsWith('webscan-')).map(([,f])=>f.prospectsResearched);
 if(researched.length&&researched.every(knownCount))noteAt(queue,researched.reduce((a,b)=>a+b,0)+' prospects recorded as researched across WebScan funnels (cumulative; not a send-ready queue).');
 noteAt(reply,'All connected inboxes in one view. Open actions require a thread audit; today’s received replies are a separate measure. Automated form alerts and self-tests are excluded.');
 opsTable(reply,['Inbox','Human replies today','Needs answer','Interested','Pricing / call','Not interested','Last thread audit'],rows.map(r=>{const q=r.replyQueue;const valid=freshEvidence(q);return [r.mailbox,shown(r.webscanHumanRepliesToday),valid?shown(q.needsAnswer):'Unverified',valid?shown(q.interested):'Unverified',valid?shown(q.pricingOrCall):'Unverified',valid?shown(q.notInterested):'Unverified',q?.checkedAt||'Not recorded']}));
 noteAt(reply,'Reply categories can overlap. Missing audits are shown as unverified, never as an empty inbox. Contact details and message content stay outside this public dashboard.');
}

function evidenceRecent(at){const age=Date.now()-Date.parse(at);return Number.isFinite(age)&&age>=-300000&&age<=5400000}
function funnelHealthState(f,record){
 if(record?.enabled===false)return 'Paused';
 if(/safety|denied|HOLD_REASON_UNAVAILABLE|OUTREACH_REVIEW_REQUIRED|OUTBOUND.*BLOCKED|OUTREACH_SEND_BLOCKED/i.test(f?.blocker||''))return 'Sending hold recorded';
 if(f?.blocker)return 'Needs attention';
 if(!f)return 'Shared / missing telemetry';
 const checked=f.sourceChecks?.gmail?.checkedAt||f.sourceChecks?.gmailPrimary?.checkedAt||f.lastChecked||f.lastRun;
 if(!evidenceRecent(checked))return 'Source check stale / unknown';
 if((f.firstEmailsSent||0)+(f.followUpsSent||0)>0)return 'Sends recorded; audit below';
 return 'No sends recorded';
}
function drawFunnelHealth(data,health){
 const root=document.getElementById('funnelHealth');root.replaceChildren();
 if(!health||!Array.isArray(health.rows)){noteAt(root,'Funnel health evidence unavailable. No healthy status can be inferred.');return}
 noteAt(root,(evidenceRecent(health.checkedAt)?'Scheduler snapshot':'STALE scheduler snapshot')+' · '+health.checkedAt+'. Email totals below are recorded cumulative campaign metrics, not today’s volume. LIVE telemetry does not mean outreach is working.');
 opsTable(root,['Funnel','Automation','Outreach health','First emails / follow-ups','Due / overdue','Follow-up audit'],health.rows.map(r=>{const f=data.funnels?.[r.id],a=r.followUpAudit||{};const recent=evidenceRecent(a.checkedAt);return [r.name,r.enabled===true?'Enabled':r.enabled===false?'Paused':'Unverified',funnelHealthState(f,r),f?shown(f.firstEmailsSent)+' / '+shown(f.followUpsSent):'Shared telemetry',recent?shown(a.due)+' / '+shown(a.overdue):'Unverified',(!recent&&a.checkedAt?'STALE · ':'')+(a.status||'UNVERIFIED').replaceAll('_',' ')]}));
 noteAt(root,'Due/overdue numbers apply only to each audit’s stated cohort. Unverified does not mean zero. Conversation responses can be included in older follow-up totals.');
 for(const r of health.rows){const f=data.funnels?.[r.id],a=r.followUpAudit||{};const details=node('details');details.appendChild(node('summary',r.name+' — evidence and next action'));noteAt(details,'Last scheduler run: '+(r.lastAutomationRun||'Unverified')+'. Next scheduler run: '+(r.enabled===false?'Paused':r.nextAutomationRun||'Not supplied by scheduler')+'.');noteAt(details,'Follow-up audit: '+(a.checkedAt||'Not recorded')+'. '+(a.summary||'Not audited.'));if(a.scope)noteAt(details,'Scope: '+a.scope);if(a.nextWindow)noteAt(details,'Next follow-up window: '+a.nextWindow);if(f?.blocker)noteAt(details,'Recorded blocker: '+f.blocker);root.appendChild(details)}
}


function researchRuns(production){
 const seen=new Set();
 return (Array.isArray(production?.runs)?production.runs:[]).filter(r=>{
  if(!r.runId||seen.has(r.runId))return false;
  seen.add(r.runId);return r.kind==='RESEARCH'&&r.measurementStatus==='COMPLETE'&&knownCount(r.candidatesAssessed)&&knownCount(r.newlyQualified)&&r.newlyQualified<=r.candidatesAssessed;
 }).sort((a,b)=>Date.parse(a.startedAt)-Date.parse(b.startedAt));
}
function drawProspectProduction(data){
 const root=document.getElementById('prospectProduction');if(!root)return;root.replaceChildren();
 const fs=Object.entries(data.funnels||{}).filter(([id])=>['webscan-general-sme','webscan-healthcare','webscan-professional-services','webscan-agency-white-label'].includes(id));
 if(!fs.length){noteAt(root,'Prospect measurement data unavailable.');return}
 noteAt(root,'Newly qualified = a unique, previously unqualified business passing evidence, contact, ownership and suppression checks. Monitoring runs, duplicate businesses and rechecks do not count as new production.');
 opsTable(root,['Funnel','Ready first emails','Due follow-ups','Last research run: assessed / newly qualified','Measured research runs','Average new per research run'],fs.map(([id,f])=>{
  const p=f.prospectProduction,q=p?.queueAudit,runs=researchRuns(p),last=runs.at(-1);
  const ready=q?.status==='VERIFIED'&&evidenceRecent(q.checkedAt);
  const average=runs.length?(runs.reduce((n,r)=>n+r.newlyQualified,0)/runs.length).toFixed(1):'Not measured';
  return [f.name,ready?shown(q.readyFirstTouches):'Unverified',ready?shown(q.dueFollowUps):'Unverified',last?shown(last.candidatesAssessed)+' / '+shown(last.newlyQualified):'Awaiting measured research run',runs.length?String(runs.length):'None recorded',average];
 }));
 const source=fs.find(([id])=>id==='webscan-general-sme')?.[1]?.prospectProduction?.sourceAudit;
 if(source){noteAt(root,'Initial source audit · '+source.checkedAt);noteAt(root,source.summary);}
 const logs=fs.flatMap(([id,f])=>(f.prospectProduction?.runs||[]).map(r=>({...r,funnel:f.name}))).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt)).slice(0,20);
 const details=node('details');details.appendChild(node('summary','Recent run measurements'));
 if(!logs.length)noteAt(details,'Measurement is configured. No per-run research samples have been recorded yet; historical cumulative totals cannot establish a production rate.');
 else opsTable(details,['Run time (UK)','Funnel','Mode / evidence','Assessed','New qualified','Duplicates / rejected','Ready after','First emails / follow-ups sent'],logs.map(r=>[r.startedAt&&Number.isFinite(Date.parse(r.startedAt))?fmtTime(new Date(r.startedAt)):'Unknown',r.funnel,(r.kind||'Unknown')+' / '+(r.measurementStatus||'UNVERIFIED'),shown(r.candidatesAssessed),shown(r.newlyQualified),shown(r.duplicatesRejected)+' / '+shown(r.rejected),shown(r.readyAfter),shown(r.firstTouchesSent)+' / '+shown(r.followUpsSent)]));
 root.appendChild(details);
 noteAt(root,'Ready stock requires a complete current queue audit. Newly qualified per run measures supply; it does not guarantee sends or sales. Prospect preparation is permitted on every hourly run; cold sending uses 09:00–19:59 UK hourly slots.');
}

const runReportIds = funnelIds.filter(id => !['nclex-colleges','nclex-recruiter-partnerships'].includes(id)).concat('webscan-inbound-leads');
async function loadRunReports() {
  return Promise.all(runReportIds.map(async id => ({id, report: await loadJson('telemetry/runs/'+id+'.json')})));
}
function drawHourlyRuns(reports, data) {
  const root=document.getElementById('hourlyRuns');if(!root)return;root.replaceChildren();
  const hour=Number(londonParts().hour);
  noteAt(root,'Cold sending: hourly from 09:00–19:59 UK. Preparation and monitoring: hourly around the clock. Effective 4 October, 13:00 UK. Slot allowances are ceilings; existing holds and prospect checks still apply. Missed slots are not accumulated.');
  const budgets=[['General SME',57],['Healthcare',22],['Professional Services',22],['Agency White Label',11]];
  opsTable(root,['WebScan funnel','Daily per inbox','This hour per inbox','This hour across 9 inboxes'],budgets.map(([name,q])=>[name,String(q),String(HourlyEvidence.slotBudget(q,hour)),String(9*HourlyEvidence.slotBudget(q,hour))]));
  noteAt(root,'The hourly figures are planned allowances before subtracting already-sent messages and applying daily, provider and mailbox-load limits. They are not a ready queue or a sending guarantee.');
  opsTable(root,['Workflow','Run state','Last outcome','Confirmed sends in report','Last heartbeat / finish','Reason / next action'],reports.map(({id,report:r})=>{
    const m=r?.metrics, count=m&&knownCount(m.firstTouchesSent)&&knownCount(m.followUpsSent)?String(m.firstTouchesSent+m.followUpsSent):'Unverified';
    return [r?.name||data.funnels?.[id]?.name||id,HourlyEvidence.runState(r),r?.outcome||'Not reported',count,r?.finishedAt||r?.heartbeatAt||'Not reported',(r?.blockers||[]).join('; ')||r?.nextAction||'Await run evidence'];
  }));
  noteAt(root,'These are per-run counts, not daily totals. A RUNNING record without a heartbeat for 45 minutes is shown as completion unverified. Completed reports and source checks become stale after 90 minutes. Scheduler activity alone is not completion evidence.');
}

const originalRefresh=refresh;
refresh=async function(){
  try{
    const [data,history,mailboxes,health,runReports]=await Promise.all([buildData(),loadHistory(),loadJson('telemetry/webscan-mailboxes.json'),loadJson('telemetry/funnel-health.json'),loadRunReports()]);
    set('activeFunnels',mailboxes?.automation ? mailboxes.automation.enabledTasks+' Enabled Automations · snapshot' : 'Automation count unverified');
    drawGlance(data);drawMilestones(data);drawAttention(data);drawAds(data);drawGoals(data);drawConversionFunnel(data);drawReplyCentre(data);drawPriorities(data);drawCategoryGrid(data);drawSummary(data);drawTimeline(data);drawFunnels(data);drawTrends(history);drawWebscanMailboxes(mailboxes);drawWebscanOperations(mailboxes,data);drawFunnelHealth(data,health);drawProspectProduction(data);drawHourlyRuns(runReports,data);
    document.getElementById('opsInboxFilter').onchange=()=>drawWebscanOperations(mailboxes,data);
    nextRefreshAt=Date.now()+REFRESH_MS;
  }catch(e){
    console.error(e);
    set('lastUpdated','Telemetry refresh failed — retrying automatically');
  }
};

refresh();
setInterval(refresh,REFRESH_MS);


