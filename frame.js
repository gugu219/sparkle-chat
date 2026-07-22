/* SPARKLECHAT — Frame Overlay runtime.
   Settings arrive either as URL params (OBS) or live via postMessage (editor preview). */
(() => {
  'use strict';

  const DEFAULTS = {
    fw: '14', fr: '28',
    c1: '#ffd6ec', c2: '#cde7ff', c3: '#e6d9ff', c4: '#d9fff0',
    glow: '55', flow: '40', shine: '50', spark: '14',
    sub: '1', follow: '1', bits: '1', points: '1', donate: '1',
    subA: 'burst', followA: 'pulse', bitsA: 'shine', pointsA: 'rainbow', donateA: 'burst',
    channel: ''
  };
  const EVENTS = ['sub', 'follow', 'bits', 'points', 'donate'];
  const STYLES = ['burst', 'pulse', 'shine', 'rainbow'];

  const qs = new URLSearchParams(location.search);
  let s = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, qs.get(k) ?? DEFAULTS[k]]));

  const root = document.documentElement;
  const stage = document.querySelector('#stage');
  const sparkles = document.querySelector('#sparkles');

  const clamp = (v, lo, hi) => { const n = parseFloat(v); return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo)); };
  const hex = (v, fallback) => { const h = String(v || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6); return h.length === 6 ? '#' + h : fallback; };

  /* ---- settings -> CSS variables ---- */
  function apply() {
    root.style.setProperty('--fw', clamp(s.fw, 0, 160) + 'px');
    root.style.setProperty('--fr', clamp(s.fr, 0, 400) + 'px');
    root.style.setProperty('--c1', hex(s.c1, DEFAULTS.c1));
    root.style.setProperty('--c2', hex(s.c2, DEFAULTS.c2));
    root.style.setProperty('--c3', hex(s.c3, DEFAULTS.c3));
    root.style.setProperty('--c4', hex(s.c4, DEFAULTS.c4));
    root.style.setProperty('--glow', (clamp(s.glow, 0, 100) / 100).toFixed(3));
    // higher slider value = faster animation
    root.style.setProperty('--flow', ((110 - clamp(s.flow, 0, 100)) / 2).toFixed(1) + 's');
    root.style.setProperty('--shine', ((110 - clamp(s.shine, 0, 100)) / 8).toFixed(2) + 's');
    buildSparkles();
  }

  /* ---- sparkles scattered along the frame band ---- */
  function makeSparkle(offset, burst) {
    const el = document.createElement('i');
    el.className = burst ? 'sparkle sparkle--burst' : 'sparkle';
    const edge = Math.floor(Math.random() * 4), along = (2 + Math.random() * 96) + '%';
    if (edge === 0) { el.style.left = along; el.style.top = offset + 'px'; }
    else if (edge === 1) { el.style.left = `calc(100% - ${offset}px)`; el.style.top = along; }
    else if (edge === 2) { el.style.left = along; el.style.top = `calc(100% - ${offset}px)`; }
    else { el.style.left = offset + 'px'; el.style.top = along; }
    el.style.setProperty('--s', (4 + Math.random() * 9).toFixed(1) + 'px');
    el.style.setProperty('--d', (2 + Math.random() * 3).toFixed(2) + 's');
    el.style.setProperty('--dl', (Math.random() * 4).toFixed(2) + 's');
    return el;
  }
  function buildSparkles() {
    const n = Math.round(clamp(s.spark, 0, 60)), offset = clamp(s.fw, 0, 160) / 2;
    sparkles.textContent = '';
    for (let i = 0; i < n; i++) sparkles.appendChild(makeSparkle(offset, false));
  }

  /* ---- event reaction ---- */
  let evTimer = null;
  function fire(kind) {
    if (!EVENTS.includes(kind) || s[kind] !== '1') return;      // respects the per-event ON/OFF
    const style = STYLES.includes(s[kind + 'A']) ? s[kind + 'A'] : 'burst';
    stage.classList.remove('is-event', ...STYLES.map(x => 'ev-' + x));
    void stage.offsetWidth;                                     // restart the animation
    stage.classList.add('is-event', 'ev-' + style);
    const offset = clamp(s.fw, 0, 160) / 2;
    for (let i = 0; i < 14; i++) {
      const sp = makeSparkle(offset, true);
      sparkles.appendChild(sp);
      setTimeout(() => sp.remove(), 1600);
    }
    clearTimeout(evTimer);
    evTimer = setTimeout(() => stage.classList.remove('is-event', ...STYLES.map(x => 'ev-' + x)), 2200);
  }

  /* ---- live settings + test events from the editor ---- */
  window.addEventListener('message', e => {
    if (e.data?.source !== 'prism-editor') return;
    if (e.data.type === 'frame-settings') { Object.assign(s, e.data.settings || {}); apply(); return; }
    if (e.data.type === 'frame-event') fire(e.data.event);
  });

  apply();

  /* ---- real Twitch events over anonymous IRC ----
     subs / resubs / gift subs / bits, plus channel-point redemptions that carry a message.
     Follows and donations are not exposed on IRC, so those stay test-only. */
  const channel = String(s.channel || '').trim().toLowerCase();
  if (channel && window.tmi) {
    const c = new window.tmi.Client({
      connection: { secure: true, reconnect: true },
      options: { skipMembership: true },
      channels: [channel]
    });
    c.on('subscription', () => fire('sub'));
    c.on('resub', () => fire('sub'));
    c.on('subgift', () => fire('sub'));
    c.on('submysterygift', () => fire('sub'));
    c.on('cheer', () => fire('bits'));
    c.on('message', (_ch, t) => { if (t && t['custom-reward-id']) fire('points'); });
    c.connect().catch(err => console.warn('[sparklechat] frame connect failed', err));
  }
})();
