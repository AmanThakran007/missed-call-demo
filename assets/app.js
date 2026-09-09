/* Missed Call Recovery — demo app.
   Vanilla JS, no dependencies, no network calls. Everything is local and fictional. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── state ─────────────────────────────────────────── */
  var state = {
    view: 'landing',      // landing | live | present
    mode: 'idle',         // idle | auto | manual
    speed: 1,
    step: 0,
    answers: {},
    liveTimeline: [],
    leads: [],
    selectedId: null,
    activeLeadId: null,   // the lead created by this demo run
    followUp: 'idle',     // idle | armed | reminded | nudged | cancelled
    side: 'customer',
    slide: 0,
    clock: null           // scenario times, fixed at the moment the lead is delivered
  };

  var gen = 0;            // cancellation token for every scheduled step
  var timers = [];

  function sleep(ms) {
    var mine = gen;
    return new Promise(function (resolve) {
      var id = setTimeout(function () { if (mine === gen) resolve(); }, Math.max(16, ms / state.speed));
      timers.push(id);
    });
  }
  function cancelAll() {
    gen++;
    timers.forEach(clearTimeout);
    timers = [];
  }

  /* ── small helpers ─────────────────────────────────── */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function firstName(full) { return String(full || '').trim().split(/\s+/)[0] || ''; }
  function fill(t, a) {
    var v = { first: firstName(a.name) };
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) v[k] = a[k];
    return t.replace(/\{(\w+)\}/g, function (_, k) { return v[k] || ''; });
  }

  /* Scenario clock. The opening beats are fixed (14:03 call, 14:04 auto-reply); the
     conversation then ticks forward a minute every few messages and never goes back. */
  function hhmm(m) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function mins(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
  var msgN = 0;
  function convNow() {
    return Math.min(mins(CLOCK.convStart) + Math.floor(msgN / CLOCK.msgsPerMin), mins(CLOCK.convEnd));
  }
  function stamp() { var t = hhmm(convNow()); msgN++; return t; }
  function sealClock() {
    var d = convNow();
    state.clock = {
      details: hhmm(d),
      delivered: hhmm(d),
      reminder: hhmm(d + CLOCK.reminderAfter),
      nudge: hhmm(d + CLOCK.nudgeAfter)
    };
  }
  function ago(ts) {
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    return 'yesterday';
  }
  function urgencyTone(label) {
    for (var i = 0; i < URGENCIES.length; i++) if (URGENCIES[i].label === label) return URGENCIES[i].tone;
    return 'amber';
  }
  var STATUS = {
    'new':        { label: 'Needs callback',     tone: 'red' },
    'contacted':  { label: 'Contacted',          tone: 'blue' },
    'booked':     { label: 'Appointment booked', tone: 'green' },
    'unsuitable': { label: 'Not suitable',       tone: 'grey' }
  };

  /* ── views ─────────────────────────────────────────── */
  function showView(v) {
    state.view = v;
    $$('.view').forEach(function (n) { n.classList.remove('is-active'); });
    var map = { landing: '#view-landing', live: '#view-live', present: '#view-present' };
    $(map[v]).classList.add('is-active');
    $('.foot').style.display = v === 'present' ? 'none' : '';
    window.scrollTo(0, 0);
  }
  function setStage(text, live) {
    $('#stageLabel').textContent = text;
    $('#stageDot').classList.toggle('live', !!live);
  }
  function setSide(side) {
    state.side = side;
    $$('.seg').forEach(function (b) { b.classList.toggle('is-on', b.dataset.side === side); });
    $('#colCustomer').classList.toggle('is-shown', side === 'customer');
    $('#colBusiness').classList.toggle('is-shown', side === 'business');
  }

  /* ── chat rendering ────────────────────────────────── */
  var chat = $('#chat');
  function scrollChat() { chat.scrollTop = chat.scrollHeight; }

  function addMsg(who, html, time) {
    var n = el('div', 'msg ' + who, html + (time ? '<span class="msg-time">' + esc(time) + '</span>' : ''));
    chat.appendChild(n); scrollChat(); return n;
  }
  function addSys(text) { return addMsg('sys', esc(text)); }
  function addBot(text) { return addMsg('bot', esc(text), stamp()); }
  function addUser(text) { return addMsg('user', esc(text), stamp()); }
  function addUserPhoto(src) {
    return addMsg('user', '<img class="msg-photo" src="' + src + '" alt="Photo sent by the customer">Photo of the boiler', stamp());
  }
  function typingOn() {
    var n = el('div', 'typing', '<span></span><span></span><span></span>');
    chat.appendChild(n); scrollChat(); return n;
  }
  function typingOff(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }

  function addSummaryCard(a) {
    var rows = [
      ['Name', a.name], ['Postcode', a.postcode], ['Job', a.category],
      ['Urgency', a.urgency], ['Callback', a.callback], ['Photo', a.photo ? 'Attached' : 'Not provided']
    ].map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    return addMsg('msg-card', '<h4>Sent to ' + esc(BUSINESS.name) + '</h4><dl>' + rows + '</dl>');
  }

  /* ── timeline ──────────────────────────────────────── */
  function sortTimeline(lead) {
    lead.timeline = lead.timeline
      .map(function (t, i) { return [t, i]; })
      .sort(function (a, b) { return (mins(a[0].time) - mins(b[0].time)) || (a[1] - b[1]); })
      .map(function (x) { return x[0]; });
    return lead.timeline;
  }
  function lastRealMin(lead) {
    return lead.timeline.reduce(function (m, t) {
      return (t.pending || t.cancelled) ? m : Math.max(m, mins(t.time));
    }, mins(state.clock ? state.clock.delivered : CLOCK.autoReply));
  }

  function tl(time, tone, text) {
    state.liveTimeline.push({ time: time, tone: tone, text: text });
    var lead = getActive();
    if (lead) { lead.timeline = state.liveTimeline.slice(); renderDetail(); }
  }

  /* ── leads ─────────────────────────────────────────── */
  function getActive() {
    return state.leads.filter(function (l) { return l.id === state.activeLeadId; })[0];
  }
  function getSelected() {
    return state.leads.filter(function (l) { return l.id === state.selectedId; })[0];
  }

  function renderLeads() {
    var list = $('#leadList');
    list.innerHTML = '';
    $('#leadCount').textContent = state.leads.length;
    state.leads.forEach(function (l) {
      var li = el('li', 'lead' + (l.id === state.selectedId ? ' is-sel' : '') + (l.fresh ? ' is-new' : ''));
      li.tabIndex = 0;
      li.innerHTML =
        '<div class="lead-top"><span class="lead-name">' + esc(l.name) + '</span>' +
        '<span class="lead-when">' + esc(l.received ? ago(l.received) : '') + '</span></div>' +
        '<div class="lead-job">' + esc(l.category) + ' · ' + esc(l.postcode) + '</div>' +
        '<div class="lead-tags"><span class="tag tag-' + urgencyTone(l.urgency) + '">' + esc(l.urgency) + '</span>' +
        '<span class="tag tag-' + STATUS[l.status].tone + '">' + esc(STATUS[l.status].label) + '</span></div>';
      li.addEventListener('click', function () { select(l.id); });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(l.id); } });
      list.appendChild(li);
      l.fresh = false;
    });
  }

  function select(id) { state.selectedId = id; renderLeads(); renderDetail(); }

  function renderDetail() {
    var d = $('#detail'), l = getSelected();
    if (!l) {
      d.innerHTML = '<div class="detail-empty">Select an enquiry to see the full job details and timeline.</div>';
      return;
    }
    var isNew = l.status === 'new';
    var photo = l.photo
      ? '<div class="photo-row"><img src="' + l.photo + '" alt="Photo sent by the customer">' +
        '<span class="photo-cap">Sent by the customer with the enquiry</span></div>'
      : '<div class="photo-row"><span class="photo-cap">No photo provided</span></div>';

    var facts = [
      ['Location', l.postcode], ['Job', l.category], ['Urgency', l.urgency],
      ['Preferred callback', l.callback], ['Source', l.source], ['Received', ago(l.received)]
    ].map(function (f) {
      return '<div class="fact"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
    }).join('');

    var acts = l.status === 'unsuitable' ? '' :
      '<div class="actions">' +
        '<button class="act act-primary" data-act="call">📞 Call customer</button>' +
        '<button class="act' + (l.status !== 'new' ? ' is-done' : '') + '" data-act="contacted">' +
          (l.status !== 'new' ? '✓ Contacted' : 'Mark contacted') + '</button>' +
        '<button class="act' + (l.status === 'booked' ? ' is-done' : '') + '" data-act="booked">' +
          (l.status === 'booked' ? '✓ Appointment booked' : 'Book appointment') + '</button>' +
        '<button class="act" data-act="unsuitable">Not suitable</button>' +
      '</div>' +
      '<p class="act-note">Demo controls — nothing is dialled, booked or sent. They update this example only.</p>';

    var rows = (l.timeline || []).map(function (t, i, arr) {
      var cls = 'tl' + (t.pending ? ' tl-pending' : '') + (t.cancelled ? ' tl-cancelled' : '') +
        (i === arr.length - 1 && t.fresh ? ' is-fresh' : '');
      return '<li class="' + cls + '">' +
        '<span class="tl-time">' + esc(t.time) + '</span>' +
        '<span class="tl-rail"><i class="tl-node is-' + t.tone + '"></i></span>' +
        '<span class="tl-txt">' + (t.cancelled ? '<s>' + t.text + '</s>' : t.text) +
          (t.cancelled ? ' <span class="tl-flag">CANCELLED</span>' : '') +
          (t.pending ? ' <span class="tl-flag tl-flag-soft">SCHEDULED</span>' : '') +
        '</span></li>';
    }).join('');

    var plan = '';
    if (l.id === state.activeLeadId) {
      if (state.followUp === 'cancelled') {
        plan = '<div class="plan is-off"><strong>Follow-up stopped.</strong> You responded, so the scheduled reminder and customer follow-up were cancelled.</div>';
      } else if (state.followUp !== 'idle') {
        plan = '<div class="plan"><strong>Follow-up plan.</strong> ' +
          'If nobody responds by ' + state.clock.reminder + ' we remind you. ' +
          'If it’s still open at ' + state.clock.nudge + ' we message the customer so the enquiry stays warm. ' +
          'Acting on this enquiry cancels both.</div>';
      }
    }

    d.innerHTML =
      '<div class="detail-head"><div>' +
        (isNew ? '<span class="newflag">NEW ENQUIRY</span>' : '') +
        '<h2>' + esc(l.name) + '</h2></div>' +
        '<span class="tag tag-' + STATUS[l.status].tone + '">' + esc(STATUS[l.status].label) + '</span>' +
      '</div>' +
      '<dl class="facts">' + facts + '</dl>' +
      '<div class="quote">“' + esc(l.description) + '”</div>' +
      photo + acts +
      '<div class="section-h">Timeline</div><ul class="timeline">' + rows + '</ul>' + plan;

    $$('.act', d).forEach(function (b) {
      b.addEventListener('click', function () { doAction(l, b.dataset.act); });
    });
  }

  /* ── business actions ──────────────────────────────── */
  function doAction(lead, act) {
    var t = hhmm(lastRealMin(lead) + 2);
    if (act === 'call') {
      lead.status = lead.status === 'booked' ? 'booked' : 'contacted';
      lead.timeline.push({ time: t, tone: 'green', text: '<b>Business called the customer back</b>', fresh: true });
      toast('Calling customer', 'Demo only — no call is placed.');
    } else if (act === 'contacted') {
      lead.status = lead.status === 'booked' ? 'booked' : 'contacted';
      lead.timeline.push({ time: t, tone: 'green', text: '<b>Marked contacted</b> by the business', fresh: true });
      toast('Marked contacted', 'Follow-ups for this enquiry stop here.');
    } else if (act === 'booked') {
      lead.status = 'booked';
      lead.timeline.push({ time: t, tone: 'green', text: '<b>Appointment booked</b> — ' + esc(lead.callback), fresh: true });
      toast('Appointment booked', lead.callback + ' — demo only.');
    } else if (act === 'unsuitable') {
      lead.status = 'unsuitable';
      lead.timeline.push({ time: t, tone: 'grey', text: '<b>Marked not suitable</b> — customer told politely, no further follow-up', fresh: true });
      toast('Marked not suitable', 'The customer gets a short, polite message.');
    }
    if (lead.id === state.activeLeadId && state.followUp !== 'cancelled') {
      state.followUp = 'cancelled';
      cancelPendingFollowUps(lead);
      cancelAll();
      setStage('Business responded — follow-ups cancelled', false);
    }
    sortTimeline(lead);
    if (lead.id === state.activeLeadId) state.liveTimeline = lead.timeline;
    renderLeads(); renderDetail();
  }

  /* Scheduled follow-ups that never ran are kept on the timeline, struck through and
     marked CANCELLED, so the demo can never imply they were sent. */
  function cancelPendingFollowUps(lead) {
    lead.timeline.forEach(function (t) {
      if (t.pending) { t.pending = false; t.cancelled = true; t.tone = 'grey'; }
    });
    state.liveTimeline = lead.timeline;
  }

  /* ── toasts ────────────────────────────────────────── */
  function toast(title, body) {
    var w = $('#toastWrap');
    var n = el('div', 'toast', '<div><b>' + esc(title) + '</b>' + esc(body || '') + '</div>');
    w.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 5200);
  }

  /* ── building the lead ─────────────────────────────── */
  function deliverLead() {
    var a = state.answers;
    var lead = {
      id: 'live-' + Date.now(),
      name: a.name || 'Customer',
      postcode: (a.postcode || '').toUpperCase(),
      category: a.category || 'Other',
      description: a.description || '—',
      urgency: a.urgency || 'This week is fine',
      callback: a.callback || 'Any time',
      photo: a.photo || null,
      source: 'Missed call recovery',
      status: 'new',
      received: Date.now(),
      fresh: true,
      timeline: state.liveTimeline.slice()
    };
    state.leads.unshift(lead);
    state.activeLeadId = lead.id;
    state.selectedId = lead.id;
    renderLeads(); renderDetail();
    toast('New enquiry', lead.name + ' · ' + lead.category + ' · ' + lead.postcode);
    if (window.matchMedia('(max-width:900px)').matches) setSide('business');
  }

  function dropPending(lead, key) {
    lead.timeline = lead.timeline.filter(function (t) { return !(t.pending && t.key === key); });
  }

  function armFollowUpPending() {
    state.followUp = 'armed';
    var lead = getActive();
    if (!lead) return;
    lead.timeline.push({ time: state.clock.reminder, tone: 'grey', pending: true, key: 'reminder',
      text: 'Reminder to the business if no response' });
    lead.timeline.push({ time: state.clock.nudge, tone: 'grey', pending: true, key: 'nudge',
      text: 'Follow-up message to the customer if still open' });
    sortTimeline(lead);
    state.liveTimeline = lead.timeline;
    renderDetail();
  }

  function fireReminder() {
    var lead = getActive();
    if (!lead || state.followUp === 'cancelled') return;
    state.followUp = 'reminded';
    dropPending(lead, 'reminder');
    lead.timeline.push({ time: state.clock.reminder, tone: 'amber', fresh: true,
      text: '<b>Reminder sent to business</b> — enquiry still unanswered after ' + CLOCK.reminderAfter + ' minutes' });
    sortTimeline(lead);
    state.liveTimeline = lead.timeline;
    renderDetail();
    toast('Reminder sent to you', firstName(lead.name) + '’s enquiry is still waiting.');
  }

  function fireNudge() {
    var lead = getActive();
    if (!lead || state.followUp === 'cancelled') return;
    state.followUp = 'nudged';
    dropPending(lead, 'nudge');
    lead.timeline.push({ time: state.clock.nudge, tone: 'amber', fresh: true,
      text: '<b>Customer follow-up sent</b> — “We’ve got your details and you’re on the list for today.”' });
    sortTimeline(lead);
    state.liveTimeline = lead.timeline;
    renderDetail();
    addMsg('bot', esc('We’ve got your details and you’re on the list — someone will be in touch about the time you asked for. If anything changes, just reply here.'), state.clock.nudge);
    toast('Customer kept warm', 'The enquiry has not gone cold.');
  }

  /* ── automatic demo ────────────────────────────────
     Paced for a sales call: ~9s call and response, ~23s collecting the job details,
     ~11s on the lead landing (the moment that sells it), ~9s on follow-up. ~52s total. */
  async function runAuto() {
    resetDemo(true);
    state.mode = 'auto';
    showView('live'); setSide('customer');
    $('#composer').hidden = true;

    setStage('Customer is calling…', true);
    $('#callScreen').hidden = false;
    $('#callMissed').hidden = true;
    $('#callStatus').textContent = 'Calling…';
    $('#callRing').hidden = false;
    await sleep(3000);

    $('#callStatus').textContent = 'Missed call';
    $('#callRing').hidden = true;
    $('#callMissed').hidden = false;
    setStage('Call missed — you’re on a job', true);
    tl(CLOCK.called, 'blue', '<b>Customer called</b> — 07700 900 812');
    tl(CLOCK.unanswered, 'red', '<b>Call unanswered</b> — rang out after 25 seconds');
    await sleep(1800);

    $('#callScreen').hidden = true;
    addSys('Missed call · ' + CLOCK.called);
    setStage('Responding automatically…', true);
    await sleep(600);

    for (var i = 0; i < SCRIPT.length; i++) {
      var step = SCRIPT[i];
      var long = step.field === 'description';
      for (var b = 0; b < step.bot.length; b++) {
        var t = typingOn();
        await sleep(800);
        typingOff(t);
        addBot(fill(step.bot[b], state.answers));
        if (i === 0 && b === 0) tl(CLOCK.autoReply, 'amber', '<b>Automated response sent</b> — text message delivered in 12 seconds');
        await sleep(400);
      }
      setStage('Collecting the job details…', true);
      await sleep(long ? 1400 : 1100);

      if (step.kind === 'photo') {
        $('#chatPresence').textContent = 'attaching a photo…';
        await sleep(1000);
        $('#chatPresence').textContent = 'SMS';
        state.answers.photo = step.auto;
        addUserPhoto(step.auto);
      } else {
        $('#chatPresence').textContent = 'typing…';
        await sleep(long ? 1500 : 900);
        $('#chatPresence').textContent = 'SMS';
        state.answers[step.field] = step.auto;
        addUser(step.auto);
      }
      await sleep(350);
    }

    sealClock();
    tl(state.clock.details, 'blue', '<b>Customer provided details</b> — 6 answers and 1 photo');
    var t2 = typingOn(); await sleep(900); typingOff(t2);
    addBot('Thanks ' + firstName(state.answers.name) + ' — that’s everything. This is with ' + BUSINESS.name +
      ' now and they’ll come back to you about today, 4–6 PM.');
    await sleep(1000);
    addSummaryCard(state.answers);
    await sleep(1800);

    tl(state.clock.delivered, 'green', '<b>Qualified lead sent to the business</b>');
    setStage('Qualified lead delivered', true);
    deliverLead();
    armFollowUpPending();
    await sleep(6500);

    setStage('Nobody has responded yet…', true);
    await sleep(2500);
    fireReminder();
    await sleep(4500);
    fireNudge();
    await sleep(3000);

    setStage('Demo complete — the enquiry is still live', false);
    state.mode = 'idle';
    toast('That’s the demo', 'A missed call became a qualified enquiry in about three minutes.');
  }

  /* ── manual mode ───────────────────────────────────── */
  async function runManual() {
    resetDemo(true);
    state.mode = 'manual';
    showView('live'); setSide('customer');

    setStage('Call missed — you’re on a job', true);
    $('#callScreen').hidden = false;
    $('#callMissed').hidden = true;
    $('#callStatus').textContent = 'Calling…';
    $('#callRing').hidden = false;
    await sleep(1800);
    $('#callStatus').textContent = 'Missed call';
    $('#callRing').hidden = true;
    $('#callMissed').hidden = false;
    tl(CLOCK.called, 'blue', '<b>Customer called</b> — 07700 900 812');
    tl(CLOCK.unanswered, 'red', '<b>Call unanswered</b> — rang out after 25 seconds');
    await sleep(1200);
    $('#callScreen').hidden = true;
    addSys('Missed call · ' + CLOCK.called);

    state.step = 0;
    askStep();
  }

  async function askStep() {
    var step = SCRIPT[state.step];
    hideComposer();
    for (var b = 0; b < step.bot.length; b++) {
      var t = typingOn();
      await sleep(800);
      typingOff(t);
      addBot(fill(step.bot[b], state.answers));
      if (state.step === 0 && b === 0) tl(CLOCK.autoReply, 'amber', '<b>Automated response sent</b> — SMS delivered in 12 seconds');
      await sleep(350);
    }
    showComposer(step);
  }

  function hideComposer() {
    $('#composer').hidden = true;
    $('#chips').hidden = true;
    $('#composerRow').hidden = true;
    $('#composerPhoto').hidden = true;
  }

  function showComposer(step) {
    var c = $('#composer');
    c.hidden = false;
    if (step.kind === 'chips') {
      var chips = $('#chips');
      chips.innerHTML = '';
      chips.hidden = false;
      step.options.forEach(function (o) {
        var b = el('button', 'chip', esc(o));
        b.type = 'button';
        b.addEventListener('click', function () {
          b.classList.add('is-picked');
          answer(step, o);
        });
        chips.appendChild(b);
      });
    } else if (step.kind === 'photo') {
      $('#composerPhoto').hidden = false;
    } else {
      $('#composerRow').hidden = false;
      var input = $('#composerInput');
      input.value = '';
      input.placeholder = step.placeholder || 'Type your reply…';
      input.focus();
    }
    scrollChat();
  }

  function answer(step, value, isPhoto) {
    if (!step || state.step >= SCRIPT.length) return;
    hideComposer();
    if (isPhoto) {
      state.answers.photo = value;
      addUserPhoto(value);
    } else if (step.kind === 'photo') {
      state.answers.photo = null;
      addUser('No photo, thanks');
    } else {
      state.answers[step.field] = value;
      addUser(value);
    }
    state.step++;
    if (state.step < SCRIPT.length) askStep();
    else finishManual();
  }

  async function finishManual() {
    var n = firstName(state.answers.name) || 'there';
    var got = ['name', 'postcode', 'category', 'description', 'urgency', 'callback']
      .filter(function (k) { return state.answers[k]; }).length;
    sealClock();
    tl(state.clock.details, 'blue', '<b>Customer provided details</b> — ' + got + ' answers and ' +
      (state.answers.photo ? '1 photo' : 'no photo'));
    var t = typingOn(); await sleep(900); typingOff(t);
    addBot('Thanks ' + n + ' — that’s everything. This is with ' + BUSINESS.name + ' now and they’ll come back to you.');
    await sleep(700);
    addSummaryCard(state.answers);
    await sleep(1200);
    tl(state.clock.delivered, 'green', '<b>Qualified lead sent to the business</b>');
    await sleep(600);
    setStage('Qualified lead delivered', true);
    deliverLead();
    armFollowUpPending();

    /* follow-up runs on a short demo timer unless the business acts */
    await sleep(9000);
    setStage('Nobody has responded yet…', true);
    fireReminder();
    await sleep(9000);
    fireNudge();
    setStage('Enquiry kept warm — try the dashboard actions', false);
    state.mode = 'idle';
  }

  /* ── reset ─────────────────────────────────────────── */
  function resetDemo(keepView) {
    cancelAll();
    state.mode = 'idle';
    state.step = 0;
    state.answers = {};
    state.liveTimeline = [];
    state.activeLeadId = null;
    state.followUp = 'idle';
    state.clock = null;
    msgN = 0;
    state.leads = SEED_LEADS.map(function (s) {
      var c = JSON.parse(JSON.stringify(s));
      c.received = Date.now() - s.receivedAgo;
      return c;
    });
    state.selectedId = state.leads[0].id;
    chat.innerHTML = '';
    $('#toastWrap').innerHTML = '';
    $('#callScreen').hidden = true;
    $('#chatPresence').textContent = 'SMS';
    hideComposer();
    setSide('customer');
    renderLeads(); renderDetail();
    setStage('Ready', false);
    if (!keepView) showView('landing');
  }

  /* ── presentation mode ─────────────────────────────── */
  function renderSlide() {
    var s = SLIDES[state.slide];
    $('#slide').innerHTML =
      '<div class="slide-n">' + esc(s.n) + ' of ' + SLIDES.length + '</div>' +
      '<h2>' + esc(s.h) + '</h2>' +
      '<p>' + esc(s.p) + '</p>' +
      '<div class="slide-art' + (s.quote ? ' art-quote' : '') + '">' + s.art + '</div>';
    var dots = $('#slideDots');
    dots.innerHTML = '';
    SLIDES.forEach(function (_, i) {
      var b = el('button', 'sdot' + (i === state.slide ? ' is-on' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', 'Slide ' + (i + 1));
      b.addEventListener('click', function () { state.slide = i; renderSlide(); });
      dots.appendChild(b);
    });
    $('#slidePrev').disabled = state.slide === 0;
    $('#slideNext').textContent = state.slide === SLIDES.length - 1 ? 'Start over' : 'Next →';
  }
  function nextSlide() {
    state.slide = (state.slide + 1) % SLIDES.length;
    renderSlide();
  }
  function prevSlide() {
    if (state.slide > 0) { state.slide--; renderSlide(); }
  }

  /* ── wiring ────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b) return;
    var a = b.dataset.action;
    if (a === 'run') runAuto();
    else if (a === 'manual') runManual();
    else if (a === 'reset') resetDemo(false);
    else if (a === 'present') { cancelAll(); state.slide = 0; showView('present'); renderSlide(); }
    else if (a === 'exit-present') showView(state.leads.length > SEED_LEADS.length ? 'live' : 'landing');
  });

  $('#slideNext').addEventListener('click', nextSlide);
  $('#slidePrev').addEventListener('click', prevSlide);

  $$('.speed-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.speed = +b.dataset.speed;
      $$('.speed-btn').forEach(function (x) { x.classList.toggle('is-on', x === b); });
    });
  });

  $$('.seg').forEach(function (b) {
    b.addEventListener('click', function () { setSide(b.dataset.side); });
  });

  $('#composerSend').addEventListener('click', sendTyped);
  $('#composerInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); sendTyped(); }
  });
  function sendTyped() {
    var step = SCRIPT[state.step];
    if (!step) return;
    var v = $('#composerInput').value.trim();
    if (!v) return;
    if (step.validate && !step.validate(v)) { retryStep(step, v); return; }
    answer(step, step.normalise ? step.normalise(v) : v);
  }

  /* Shows what the customer sent, explains the problem, asks again. */
  async function retryStep(step, typed) {
    hideComposer();
    addUser(typed);
    var t = typingOn();
    await sleep(800);
    typingOff(t);
    addBot(step.retry || 'Sorry, could you try that again?');
    await sleep(300);
    showComposer(step);
  }

  $('#photoSample').addEventListener('click', function () {
    answer(SCRIPT[state.step], DEMO_PHOTO, true);
  });
  $('#photoSkip').addEventListener('click', function () {
    answer(SCRIPT[state.step], null, false);
  });
  $('#photoInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { answer(SCRIPT[state.step], r.result, true); };
    r.readAsDataURL(f);
    e.target.value = '';
  });

  document.addEventListener('keydown', function (e) {
    if (state.view !== 'present') return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
    else if (e.key === 'ArrowLeft') prevSlide();
    else if (e.key === 'Escape') showView('landing');
  });

  /* keep "received x minutes ago" honest while the demo is on screen */
  setInterval(function () {
    if (state.view === 'live') { renderLeads(); renderDetail(); }
  }, 30000);

  resetDemo(false);
})();
