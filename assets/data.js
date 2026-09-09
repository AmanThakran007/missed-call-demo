/* Missed Call Recovery — demo content.
   All names, numbers, postcodes and messages below are fictional. */

const BUSINESS = {
  name: 'Guildford Heating & Plumbing',
  initials: 'GH',
  phone: '01483 000 000'
};

const CATEGORIES = [
  'Boiler breakdown',
  'Leaking pipe',
  'No heating',
  'Blocked drain',
  'Boiler installation',
  'Radiator issue',
  'Other'
];

const URGENCIES = [
  { label: 'Emergency — today', tone: 'red' },
  { label: 'Urgent — no heating', tone: 'red' },
  { label: 'This week is fine', tone: 'amber' },
  { label: 'Just after a quote', tone: 'grey' }
];

const CALLBACKS = ['Today, 4–6 PM', 'Today, any time', 'Tomorrow morning', 'Tomorrow, 6–8 PM'];

/* A fictional "customer photo": a boiler display showing an error code.
   Inline SVG so the demo needs no image files and works offline. */
const DEMO_PHOTO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="315" viewBox="0 0 420 315">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef1f4"/><stop offset="1" stop-color="#d7dde3"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fdfdfd"/><stop offset="1" stop-color="#e4e8ec"/>
    </linearGradient>
  </defs>
  <rect width="420" height="315" fill="url(#w)"/>
  <rect x="72" y="34" width="276" height="250" rx="10" fill="url(#b)" stroke="#b9c3cc" stroke-width="2"/>
  <rect x="92" y="54" width="236" height="96" rx="6" fill="#f4f6f8" stroke="#cfd7de"/>
  <rect x="120" y="72" width="180" height="60" rx="5" fill="#16323f"/>
  <text x="210" y="114" font-family="monospace" font-size="38" fill="#7ee0b6" text-anchor="middle" letter-spacing="4">E133</text>
  <circle cx="128" cy="200" r="20" fill="#e9edf1" stroke="#c2cad2" stroke-width="2"/>
  <circle cx="128" cy="200" r="4" fill="#8b98a5"/>
  <circle cx="292" cy="200" r="20" fill="#e9edf1" stroke="#c2cad2" stroke-width="2"/>
  <circle cx="292" cy="200" r="4" fill="#8b98a5"/>
  <rect x="168" y="186" width="84" height="28" rx="6" fill="#eef1f4" stroke="#c9d1d8"/>
  <circle cx="182" cy="200" r="5" fill="#c8402c"/>
  <text x="210" y="205" font-family="sans-serif" font-size="11" fill="#6c7883" text-anchor="middle">LOCKOUT</text>
  <rect x="92" y="238" width="236" height="26" rx="5" fill="#eef1f4" stroke="#cfd7de"/>
  <text x="210" y="256" font-family="sans-serif" font-size="12" fill="#8b98a5" text-anchor="middle">combi boiler — front panel</text>
</svg>`);

/* ── the conversation the system runs with the caller ── */
const SCRIPT = [
  {
    field: 'name',
    bot: [
      `Hi — sorry we couldn’t answer your call just now, the team’s out on a job.`,
      `I can take a few details and get someone back to you. Can I start with your name?`
    ],
    kind: 'text',
    placeholder: 'Your name',
    auto: 'Sarah Thompson'
  },
  {
    field: 'postcode',
    bot: ['Thanks {first}. What’s your postcode?'],
    kind: 'text',
    placeholder: 'e.g. GU1 4AB',
    auto: 'GU1 4AB',
    validate: function (v) {
      return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(String(v).toUpperCase().replace(/\s+/g, ''));
    },
    normalise: function (v) {
      var s = String(v).toUpperCase().replace(/\s+/g, '');
      return s.slice(0, -3) + ' ' + s.slice(-3);
    },
    retry: 'Sorry, that doesn’t look like a UK postcode. Could you check it? Something like GU1 4AB.'
  },
  {
    field: 'category',
    bot: ['What do you need help with?'],
    kind: 'chips',
    options: CATEGORIES,
    auto: 'Boiler breakdown'
  },
  {
    field: 'description',
    bot: ['Got it. In a sentence or two, what’s happening?'],
    kind: 'text',
    placeholder: 'Brief description',
    auto: 'Boiler stopped working this morning. Error code E133 and no hot water.'
  },
  {
    field: 'urgency',
    bot: ['How urgent is it?'],
    kind: 'chips',
    options: URGENCIES.map(u => u.label),
    auto: 'Urgent — no heating'
  },
  {
    field: 'callback',
    bot: ['When suits you for a callback?'],
    kind: 'chips',
    options: CALLBACKS,
    auto: 'Today, 4–6 PM'
  },
  {
    field: 'photo',
    bot: ['Last thing — a photo of the boiler or the error display helps the engineer turn up prepared. Optional.'],
    kind: 'photo',
    auto: DEMO_PHOTO
  }
];

/* ── scenario clock used by the timeline ── */
const CLOCK = {
  called:     '14:03',
  unanswered: '14:03',
  autoReply:  '14:04',
  convStart:  '14:04',   // first message of the conversation
  convEnd:    '14:06',   // conversation never stamps later than this
  msgsPerMin: 5,         // messages before the displayed minute ticks on
  reminderAfter: 15,     // minutes after delivery
  nudgeAfter:    40
};

/* ── leads already in the dashboard, so it never looks empty ── */
const SEED_LEADS = [
  {
    id: 'seed-1',
    name: 'Daniel Okafor',
    postcode: 'GU2 7XH',
    category: 'Blocked drain',
    description: 'Kitchen sink is draining very slowly and there’s a smell from the outside gully.',
    urgency: 'This week is fine',
    callback: 'Tomorrow morning',
    photo: null,
    source: 'Missed call recovery',
    status: 'contacted',
    receivedAgo: 3 * 60 * 60 * 1000,
    seeded: true,
    timeline: [
      { time: '11:12', tone: 'blue',  text: '<b>Customer called</b> — 07700 900 461' },
      { time: '11:12', tone: 'red',   text: '<b>Call unanswered</b> — rang out after 25 seconds' },
      { time: '11:13', tone: 'amber', text: '<b>Automated response sent</b> — SMS delivered' },
      { time: '11:16', tone: 'blue',  text: '<b>Customer provided details</b> — 6 answers, no photo' },
      { time: '11:16', tone: 'green', text: '<b>Qualified lead sent to business</b>' },
      { time: '11:41', tone: 'green', text: '<b>Business marked contacted</b> — follow-ups cancelled' }
    ]
  },
  {
    id: 'seed-2',
    name: 'Priya Raman',
    postcode: 'GU12 4NB',
    category: 'Boiler installation',
    description: 'Looking for a quote to replace a 14-year-old combi boiler. Three-bed semi, one bathroom.',
    urgency: 'Just after a quote',
    callback: 'Tomorrow, 6–8 PM',
    photo: null,
    source: 'Missed call recovery',
    status: 'booked',
    receivedAgo: 26 * 60 * 60 * 1000,
    seeded: true,
    timeline: [
      { time: '16:48', tone: 'blue',  text: '<b>Customer called</b> — 07700 900 118' },
      { time: '16:48', tone: 'red',   text: '<b>Call unanswered</b> — outside working hours' },
      { time: '16:48', tone: 'amber', text: '<b>Automated response sent</b> — SMS delivered' },
      { time: '16:53', tone: 'blue',  text: '<b>Customer provided details</b> — 6 answers, no photo' },
      { time: '16:53', tone: 'green', text: '<b>Qualified lead sent to business</b>' },
      { time: '17:10', tone: 'amber', text: '<b>Reminder sent to business</b> — no response after 15 minutes' },
      { time: '17:22', tone: 'green', text: '<b>Appointment booked</b> — survey Thursday 5:30 PM' }
    ]
  }
];

/* ── sales-mode slides ── */
const SLIDES = [
  {
    n: 'Screen 1',
    h: 'Customer calls while you’re on a job.',
    p: 'A new customer with a broken boiler rings your number at 14:03. Your hands are full.',
    art: `<div class="art-row"><span>Caller</span><span>07700 900 812</span></div>
          <div class="art-row"><span>Time</span><span>14:03</span></div>
          <div class="art-row"><span>Ringing</span><span>25 seconds</span></div>`
  },
  {
    n: 'Screen 2',
    h: 'Call goes unanswered.',
    p: 'When they don’t leave a voicemail, all you have is a number.',
    art: `<div class="art-row"><span>Result</span><span>Missed call</span></div>
          <div class="art-row"><span>Voicemail left</span><span>No</span></div>
          <div class="art-row"><span>What you know</span><span>A number, nothing else</span></div>`
  },
  {
    n: 'Screen 3',
    h: 'The customer gets an immediate response.',
    p: 'Within a minute they receive a message from your business — not silence.',
    art: `<div class="art-quote">“Hi — sorry we couldn’t answer your call just now, the team’s out on a job. I can take a few details and get someone back to you.”</div>`,
    quote: true
  },
  {
    n: 'Screen 4',
    h: 'The system collects the job details.',
    p: 'Name, postcode, job type, description, urgency, a callback time, and a photo if they have one.',
    art: `<div class="art-row"><span>Name</span><span>Sarah Thompson</span></div>
          <div class="art-row"><span>Postcode</span><span>GU1 4AB</span></div>
          <div class="art-row"><span>Job</span><span>Boiler breakdown</span></div>
          <div class="art-row"><span>Urgency</span><span>Urgent — no heating</span></div>
          <div class="art-row"><span>Photo</span><span>Attached</span></div>`
  },
  {
    n: 'Screen 5',
    h: 'You receive a qualified enquiry.',
    p: 'One screen with everything you need to decide whether to take the job — and to call back knowing what it is.',
    art: `<div class="art-row"><span>Received</span><span>14:06 — 3 minutes after the call</span></div>
          <div class="art-row"><span>Callback window</span><span>Today, 4–6 PM</span></div>
          <div class="art-row"><span>Status</span><span>Needs callback</span></div>`
  },
  {
    n: 'Screen 6',
    h: 'If nobody follows up, the system keeps the lead warm.',
    p: 'A reminder goes to you, then a short message to the customer so the enquiry doesn’t quietly go cold.',
    art: `<div class="art-row"><span>14:21</span><span>Reminder sent to you</span></div>
          <div class="art-row"><span>14:46</span><span>Customer follow-up sent</span></div>
          <div class="art-row"><span>If you respond</span><span>Follow-ups stop</span></div>`
  },
  {
    n: 'Screen 7',
    h: 'Would this be useful for your business?',
    p: 'Never lose a good enquiry just because you couldn’t answer the phone.',
    art: `<div class="art-quote">We respond immediately, collect the job details and get the opportunity back to you.</div>`,
    quote: true
  }
];
