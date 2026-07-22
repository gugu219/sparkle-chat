/* SPARKLECHAT — Frame Overlay runtime.
   Settings arrive as URL params (OBS) or live via postMessage (editor preview). */
(() => {
  'use strict';

  const EVENTS = ['sub', 'gift', 'follow', 'bits', 'points', 'donate'];
  const STYLES = ['burst', 'pulse', 'shine', 'rainbow'];
  const MOTIONS = ['rise', 'fall', 'float', 'pile'];
  const SHAPES = { heart: 'var(--m-heart)', coin: 'var(--m-coin)', shine: 'var(--m-shine)' };

  /* per-event particle defaults: shape, motion, count, size, speed, opacity */
  const P_DEF = {
    sub:    ['heart', 'pile',  '5',  '38', '50', '90'],
    gift:   ['heart', 'fall',  '14', '30', '55', '85'],
    follow: ['shine', 'float', '10', '24', '40', '80'],
    bits:   ['coin',  'rise',  '14', '26', '60', '85'],
    points: ['shine', 'rise',  '12', '26', '50', '80'],
    donate: ['mix',   'fall',  '16', '32', '50', '85']
  };

  const DEFAULTS = {
    fw: '14', fr: '28', fri: '14',
    mode: 'gradient', ccount: '4',
    c1: '#ffd6ec', c2: '#cde7ff', c3: '#e6d9ff', c4: '#d9fff0',
    c5: '#fff3c4', c6: '#ffd9d9', c7: '#d9f2ff', c8: '#f0d9ff',
    glow: '55', flow: '40', shine: '50', spark: '14',
    sub: '1', gift: '1', follow: '1', bits: '1', points: '1', donate: '1',
    subA: 'burst', giftA: 'burst', followA: 'pulse', bitsA: 'shine', pointsA: 'rainbow', donateA: 'burst',
    subP: '1', giftP: '1', followP: '0', bitsP: '1', pointsP: '0', donateP: '1',
    channel: ''
  };
  EVENTS.forEach(e => {
    const [sh, mo, ct, sz, sp, op] = P_DEF[e];
    Object.assign(DEFAULTS, {
      [e + 'pShape']: sh, [e + 'pMotion']: mo, [e + 'pCount']: ct,
      [e + 'pSize']: sz, [e + 'pSpeed']: sp, [e + 'pOpa']: op,
      [e + 'pCMode']: 'mix', [e + 'pC']: '#ffd6ec'
    });
  });

  const qs = new URLSearchParams(location.search);
  let s = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, qs.get(k) ?? DEFAULTS[k]]));

  const root = document.documentElement;
  const stage = document.querySelector('#stage');
  const sparkles = document.querySelector('#sparkles');
  const particles = document.querySelector('#particles');

  const clamp = (v, lo, hi) => { const n = parseFloat(v); return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo)); };
  const hex = (v, fb) => { const h = String(v || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6); return h.length === 6 ? '#' + h : fb; };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* ---- palette ---- */
  function palette() {
    const n = Math.round(clamp(s.ccount, 2, 8)), out = [];
    for (let i = 1; i <= n; i++) out.push(hex(s['c' + i], DEFAULTS['c' + i] || '#ffffff'));
    return out;
  }
  /* blocks = hard stops (no blending), gradient = smooth blend */
  function conicOf(cs, blocks) {
    if (!blocks) return `conic-gradient(from 0deg,${[...cs, cs[0]].join(',')})`;
    const step = 100 / cs.length;
    return `conic-gradient(from 0deg,${cs.map((c, i) => `${c} 0 ${((i + 1) * step).toFixed(3)}%`).join(',')})`;
  }
  function linearOf(cs, blocks) {
    if (!blocks) return `linear-gradient(135deg,${cs.join(',')})`;
    const step = 100 / cs.length;
    return `linear-gradient(135deg,${cs.map((c, i) => `${c} 0 ${((i + 1) * step).toFixed(3)}%`).join(',')})`;
  }

  /* ---- ring shape: rounded-rect path with an evenodd hole ---- */
  function roundRect(x, y, w, h, r) {
    if (w <= 0 || h <= 0) return '';
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}`
      + `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`
      + `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  function buildMask() {
    const r = stage.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    const fw = clamp(s.fw, 0, 300);
    const outer = roundRect(0, 0, W, H, clamp(s.fr, 0, 900));
    const inner = roundRect(fw, fw, W - 2 * fw, H - 2 * fw, clamp(s.fri, 0, 900));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
      + `<path fill="#fff" fill-rule="evenodd" d="${outer}${inner}"/></svg>`;
    root.style.setProperty('--ringmask', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  }

  /* ---- settings -> CSS variables ---- */
  function apply() {
    const cs = palette(), blocks = s.mode === 'blocks';
    root.style.setProperty('--fw', clamp(s.fw, 0, 300) + 'px');
    root.style.setProperty('--fr', clamp(s.fr, 0, 900) + 'px');
    root.style.setProperty('--grad-conic', conicOf(cs, blocks));
    root.style.setProperty('--grad-linear', linearOf(cs, blocks));
    root.style.setProperty('--glow', (clamp(s.glow, 0, 100) / 100).toFixed(3));
    root.style.setProperty('--flow', ((110 - clamp(s.flow, 0, 100)) / 2).toFixed(1) + 's');
    root.style.setProperty('--shine', ((110 - clamp(s.shine, 0, 100)) / 8).toFixed(2) + 's');
    buildMask();
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
    const n = Math.round(clamp(s.spark, 0, 60)), offset = clamp(s.fw, 0, 300) / 2;
    sparkles.textContent = '';
    for (let i = 0; i < n; i++) sparkles.appendChild(makeSparkle(offset, false));
  }

  /* ---- pile: a simple height-map so items stack instead of overlapping ---- */
  const PILE_MAX = 340;
  let pileCols = null, pileItems = [];
  function pileClear() { pileCols = null; pileItems.forEach(el => el.remove()); pileItems = []; }
  function pileLanding(xPct, size) {
    const W = stage.clientWidth || 1920, H = stage.clientHeight || 1080;
    const colW = Math.max(18, size * .75), n = Math.max(1, Math.ceil(W / colW));
    if (!pileCols || pileCols.length !== n) pileCols = new Array(n).fill(0);
    const i = Math.min(n - 1, Math.max(0, Math.floor(xPct / 100 * n)));
    let h = pileCols[i];
    if (h > H - size * 1.2) h = 0;                 /* column full -> start a fresh layer */
    pileCols[i] = h + size * .7;                   /* overlap slightly so it reads as a heap */
    return H - size - h;
  }

  /* ---- screen particles ---- */
  function spawnParticles(kind, mult) {
    const cfg = {
      shape: s[kind + 'pShape'] || 'mix',
      motion: MOTIONS.includes(s[kind + 'pMotion']) ? s[kind + 'pMotion'] : 'rise',
      count: Math.round(clamp(s[kind + 'pCount'], 0, 120) * Math.max(1, mult || 1)),
      size: clamp(s[kind + 'pSize'], 6, 200),
      speed: clamp(s[kind + 'pSpeed'], 0, 100),
      opa: clamp(s[kind + 'pOpa'], 0, 100) / 100,
      solid: s[kind + 'pCMode'] === 'solid',
      col: hex(s[kind + 'pC'], '#ffd6ec')
    };
    if (!cfg.count) return;
    const cs = palette(), keys = Object.keys(SHAPES);
    const base = 2.8 - cfg.speed / 100 * 1.8;      /* 2.8s .. 1.0s */
    const H = stage.clientHeight || 1080;
    for (let i = 0; i < Math.min(cfg.count, 200); i++) {
      const el = document.createElement('i');
      const shape = cfg.shape === 'mix' ? pick(keys) : (SHAPES[cfg.shape] ? cfg.shape : 'shine');
      const size = cfg.size * (.65 + Math.random() * .7);
      const x = Math.random() * 100;
      el.className = 'particle p-' + cfg.motion;
      el.style.setProperty('--pm', SHAPES[shape]);
      el.style.setProperty('--ps', size.toFixed(1) + 'px');
      el.style.setProperty('--po', cfg.opa.toFixed(2));
      el.style.setProperty('--pc1', cfg.solid ? cfg.col : pick(cs));
      el.style.setProperty('--pc2', cfg.solid ? cfg.col : pick(cs));
      el.style.left = x.toFixed(2) + '%';
      let dur = base * (.75 + Math.random() * .6), spin = 240;

      if (cfg.motion === 'rise') {
        el.style.top = (72 + Math.random() * 32).toFixed(2) + '%';
        el.style.setProperty('--pdx', ((Math.random() - .5) * 240).toFixed(0) + 'px');
        el.style.setProperty('--pdy', (-(240 + Math.random() * 460)).toFixed(0) + 'px');
      } else if (cfg.motion === 'fall') {
        const off = size + Math.random() * 120;
        el.style.top = (-off).toFixed(0) + 'px';
        el.style.setProperty('--pdx', ((Math.random() - .5) * 220).toFixed(0) + 'px');
        el.style.setProperty('--pdy', (H + off + size).toFixed(0) + 'px');
      } else if (cfg.motion === 'float') {
        el.style.top = (Math.random() * 88).toFixed(2) + '%';
        el.style.setProperty('--pdx', ((Math.random() - .5) * 170).toFixed(0) + 'px');
        el.style.setProperty('--pdy', (-(40 + Math.random() * 150)).toFixed(0) + 'px');
        dur = base * (1.7 + Math.random() * 1.3);
      } else {                                      /* pile */
        const off = size + Math.random() * 90;
        el.style.top = (-off).toFixed(0) + 'px';
        el.style.setProperty('--pdx', ((Math.random() - .5) * 40).toFixed(0) + 'px');
        el.style.setProperty('--pdy', (pileLanding(x, size) + off).toFixed(0) + 'px');
        dur = base * (.9 + Math.random() * .5);
        spin = 90;
      }
      el.style.setProperty('--pr', ((Math.random() - .5) * spin).toFixed(0) + 'deg');
      el.style.setProperty('--pd', dur.toFixed(2) + 's');
      particles.appendChild(el);

      if (cfg.motion === 'pile') {
        pileItems.push(el);
        while (pileItems.length > PILE_MAX) pileItems.shift().remove();
      } else {
        setTimeout(() => el.remove(), (dur + 1.4) * 1000);
      }
    }
  }

  /* ---- event reaction ---- */
  let evTimer = null;
  function fire(kind, mult) {
    if (!EVENTS.includes(kind) || s[kind] !== '1') return;      /* per-event ON/OFF */
    const style = STYLES.includes(s[kind + 'A']) ? s[kind + 'A'] : 'burst';
    stage.classList.remove('is-event', ...STYLES.map(x => 'ev-' + x));
    void stage.offsetWidth;                                     /* restart the animation */
    stage.classList.add('is-event', 'ev-' + style);
    const offset = clamp(s.fw, 0, 300) / 2;
    for (let i = 0; i < 14; i++) {
      const sp = makeSparkle(offset, true);
      sparkles.appendChild(sp);
      setTimeout(() => sp.remove(), 1600);
    }
    if (s[kind + 'P'] === '1') spawnParticles(kind, mult);
    clearTimeout(evTimer);
    evTimer = setTimeout(() => stage.classList.remove('is-event', ...STYLES.map(x => 'ev-' + x)), 2200);
  }

  /* ---- live settings + test events from the editor ---- */
  window.addEventListener('message', e => {
    if (e.data?.source !== 'prism-editor') return;
    if (e.data.type === 'frame-settings') { Object.assign(s, e.data.settings || {}); apply(); return; }
    if (e.data.type === 'frame-clear') { pileClear(); particles.textContent = ''; return; }
    if (e.data.type === 'frame-event') fire(e.data.event, e.data.mult);
  });

  apply();
  if (window.ResizeObserver) new ResizeObserver(buildMask).observe(stage);
  else window.addEventListener('resize', buildMask);

  /* ---- real Twitch events over anonymous IRC ----
     subs / resubs / gift subs / bits, plus channel-point redemptions carrying a message.
     Follows and donations are not exposed on IRC, so those stay test-only. */
  const channel = String(s.channel || '').trim().toLowerCase();
  if (channel && window.tmi) {
    const c = new window.tmi.Client({
      connection: { secure: true, reconnect: true },
      options: { skipMembership: true },
      channels: [channel]
    });
    c.on('subscription', () => fire('sub', 1));
    c.on('resub', () => fire('sub', 1));
    c.on('subgift', () => fire('gift', 1));
    c.on('submysterygift', (_ch, _u, n) => fire('gift', Math.max(1, Math.min(20, +n || 1))));
    c.on('cheer', (_ch, t) => fire('bits', Math.max(1, Math.min(10, Math.round((+(t && t.bits) || 100) / 100)))));
    c.on('message', (_ch, t) => { if (t && t['custom-reward-id']) fire('points', 1); });
    c.connect().catch(err => console.warn('[sparklechat] frame connect failed', err));
  }
})();
