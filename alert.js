/* SPARKLECHAT — Alert Overlay runtime (first pass / skeleton).
   Settings arrive as URL params (OBS) or live via postMessage (editor preview). */
(() => {
  'use strict';

  const EVENTS = ['sub', 'gift', 'follow', 'bits', 'points', 'donate'];

  /* icon, title, message template ({n} = name, {a} = amount) */
  const PRESET = {
    sub:    ['🎉', 'NEW SUB',        '{n} がサブスクしました！'],
    gift:   ['🎁', 'GIFT SUB',       '{n} が {a} 人にギフト！'],
    follow: ['💖', 'NEW FOLLOWER',   '{n} がフォローしました！'],
    bits:   ['💎', 'CHEER',          '{n} が {a} Bits！'],
    points: ['✨', 'CHANNEL POINTS', '{n} がポイントを使いました'],
    donate: ['💰', 'DONATION',       '{n} から {a} のサポート！']
  };

  const DEFAULTS = {
    pos: 'bc', bub: '#ffffff', txt: '#3c3450', acc: '#ff8fc5',
    size: '26', radius: '100', pad: '22', dur: '5', tail: '0',
    font: 'maru', anim: 'poyon',
    sub: '1', gift: '1', follow: '1', bits: '1', points: '1', donate: '1',
    channel: ''
  };
  const FONTS = ['maru', 'rounded', 'kaku', 'noto', 'poppins'];
  const ANIMS = ['poyon', 'slide', 'drop', 'zoom'];

  const qs = new URLSearchParams(location.search);
  let s = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, qs.get(k) ?? DEFAULTS[k]]));

  const root = document.documentElement;
  const stage = document.querySelector('#stage');
  const bubble = document.querySelector('#bubble');
  const elIcon = document.querySelector('#icon');
  const elTitle = document.querySelector('#title');
  const elMsg = document.querySelector('#msg');

  const clamp = (v, lo, hi) => { const n = parseFloat(v); return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo)); };
  const hex = (v, fb) => { const h = String(v || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6); return h.length === 6 ? '#' + h : fb; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

  const POS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

  function apply() {
    const pos = POS.includes(s.pos) ? s.pos : 'bc';
    const font = FONTS.includes(s.font) ? s.font : 'maru';
    const anim = ANIMS.includes(s.anim) ? s.anim : 'poyon';
    document.body.className = 'font-' + font;
    stage.className = 'stage pos-' + pos + ' anim-' + anim + (s.tail === '1' ? '' : ' no-tail');
    root.style.setProperty('--bub', hex(s.bub, DEFAULTS.bub));
    root.style.setProperty('--txt', hex(s.txt, DEFAULTS.txt));
    root.style.setProperty('--acc', hex(s.acc, DEFAULTS.acc));
    root.style.setProperty('--size', clamp(s.size, 10, 90) + 'px');
    const rad = clamp(s.radius, 0, 100);
    root.style.setProperty('--radius', rad >= 100 ? '999px' : rad + 'px');   /* max = full pill */
    root.style.setProperty('--pad', clamp(s.pad, 6, 60) + 'px');
  }

  /* ---- queue so alerts never overlap ---- */
  const queue = [];
  let busy = false;

  function show(kind, name, amount) {
    if (!EVENTS.includes(kind) || s[kind] !== '1') return;
    queue.push({ kind, name, amount });
    if (!busy) next();
  }
  function next() {
    const item = queue.shift();
    if (!item) { busy = false; return; }
    busy = true;
    const [icon, title, tpl] = PRESET[item.kind] || PRESET.sub;
    elIcon.textContent = icon;
    elTitle.textContent = title;
    elMsg.innerHTML = esc(tpl)
      .replace('{n}', `<span class="n">${esc(item.name || 'Someone')}</span>`)
      .replace('{a}', `<span class="n">${esc(item.amount ?? '')}</span>`);

    bubble.classList.remove('is-out', 'is-in');
    bubble.classList.add('is-on');
    void bubble.offsetWidth;
    bubble.classList.add('is-in');

    const hold = clamp(s.dur, 1, 30) * 1000;
    setTimeout(() => {
      bubble.classList.remove('is-in');
      bubble.classList.add('is-out');
      setTimeout(() => { bubble.classList.remove('is-on', 'is-out'); next(); }, 360);
    }, hold);
  }

  /* ---- live settings + test events from the editor ---- */
  window.addEventListener('message', e => {
    if (e.data?.source !== 'prism-editor') return;
    if (e.data.type === 'alert-settings') { Object.assign(s, e.data.settings || {}); apply(); return; }
    if (e.data.type === 'alert-event') show(e.data.event, e.data.name, e.data.amount);
  });

  apply();

  /* ---- real Twitch events over anonymous IRC ----
     Follows and donations are not exposed on IRC, so those stay test-only. */
  const channel = String(s.channel || '').trim().toLowerCase();
  if (channel && window.tmi) {
    const c = new window.tmi.Client({
      connection: { secure: true, reconnect: true },
      options: { skipMembership: true },
      channels: [channel]
    });
    c.on('subscription', (_ch, u) => show('sub', u, ''));
    c.on('resub', (_ch, u, m) => show('sub', u, m ? m + 'ヶ月' : ''));
    c.on('subgift', (_ch, u) => show('gift', u, 1));
    c.on('submysterygift', (_ch, u, n) => show('gift', u, n || 1));
    c.on('cheer', (_ch, t) => show('bits', (t && (t['display-name'] || t.username)) || '', (t && t.bits) || ''));
    c.on('message', (_ch, t) => { if (t && t['custom-reward-id']) show('points', t['display-name'] || t.username, ''); });
    c.connect().catch(err => console.warn('[sparklechat] alert connect failed', err));
  }
})();
