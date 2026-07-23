/* SPARKLECHAT — Alert Overlay runtime.
   Settings arrive as URL params (OBS) or live via postMessage (editor preview). */
(() => {
  'use strict';

  const EVENTS = ['sub', 'resub', 'gift', 'follow', 'bits', 'points', 'donate'];

  /* icon key + English title. detail is built per event. */
  const PRESET = {
    sub:    ['crown',  'NEW SUB'],
    resub:  ['crown',  'RESUB'],
    gift:   ['gift',   'GIFT SUB'],
    follow: ['follow', 'NEW FOLLOWER'],
    bits:   ['bits',   'CHEER'],
    points: ['star',   'CHANNEL POINTS'],
    donate: ['coin',   'DONATION']
  };

  const DEFAULTS = {
    pos: 'bc', font: 'maru', anim: 'poyon', dur: '5', tail: '0',
    size: '26', radius: '100', pad: '22',
    txt: '#ffffff', acc: '#ff8fc5',
    ico: '#ffffff', icoBg: '#ff8fc5', icoBgA: '100',
    snd: '', vol: '70',
    bg: '#181226', bgA: '62', blur: '14', glass: '140',
    brOn: '0', brC: '#ffffff', brW: '2', brA: '45',
    glOn: '0', glC: '#ff8fc5', glS: '40', glB: '40',
    sub: '1', resub: '1', gift: '1', follow: '1', bits: '1', points: '1', donate: '1',
    demo: '0', channel: ''
  };
  const FONTS = ['maru', 'rounded', 'kaku', 'noto', 'poppins'];
  const ANIMS = ['poyon', 'slide', 'drop', 'zoom'];
  const POS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

  const qs = new URLSearchParams(location.search);
  let s = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, qs.get(k) ?? DEFAULTS[k]]));

  const root = document.documentElement;
  const stage = document.querySelector('#stage');
  const bubble = document.querySelector('#bubble');
  const elIcon = document.querySelector('#icon');
  const elTitle = document.querySelector('#title');
  const elMsg = document.querySelector('#msg');
  const elDetail = document.querySelector('#detail');

  const clamp = (v, lo, hi) => { const n = parseFloat(v); return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo)); };
  const hex = (v, fb) => { const h = String(v || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6); return h.length === 6 ? '#' + h : fb; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  /* hex + 0-100 alpha -> rgba() */
  const rgba = (h, a) => {
    const c = hex(h, '#000000').slice(1);
    const n = parseInt(c, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${(clamp(a, 0, 100) / 100).toFixed(3)})`;
  };

  function apply() {
    const font = FONTS.includes(s.font) ? s.font : 'maru';
    const anim = ANIMS.includes(s.anim) ? s.anim : 'poyon';
    const pos = POS.includes(s.pos) ? s.pos : 'bc';
    document.body.className = 'font-' + font;
    stage.className = 'stage pos-' + pos + ' anim-' + anim + (s.tail === '1' ? '' : ' no-tail');

    root.style.setProperty('--size', clamp(s.size, 10, 90) + 'px');
    const rad = clamp(s.radius, 0, 100);
    root.style.setProperty('--radius', rad >= 100 ? '999px' : rad + 'px');
    root.style.setProperty('--pad', clamp(s.pad, 6, 60) + 'px');

    root.style.setProperty('--txt', hex(s.txt, DEFAULTS.txt));
    root.style.setProperty('--acc', hex(s.acc, DEFAULTS.acc));
    root.style.setProperty('--ico', hex(s.ico, DEFAULTS.ico));
    root.style.setProperty('--icoBg', rgba(s.icoBg, s.icoBgA));

    /* background: colour + opacity + frosted glass */
    root.style.setProperty('--bgc', rgba(s.bg, s.bgA));
    root.style.setProperty('--blur', clamp(s.blur, 0, 60) + 'px');
    root.style.setProperty('--glass', clamp(s.glass, 100, 300) + '%');

    /* border */
    const brOn = s.brOn === '1';
    root.style.setProperty('--brW', (brOn ? clamp(s.brW, 0, 12) : 0) + 'px');
    root.style.setProperty('--brc', brOn ? rgba(s.brC, s.brA) : 'transparent');

    /* glow + depth shadow */
    const depth = '0 12px 30px -14px rgba(10,5,20,.5)';
    root.style.setProperty('--shadow', s.glOn === '1'
      ? `0 0 ${clamp(s.glB, 0, 120)}px ${clamp(s.glS, 0, 100) / 4}px ${rgba(s.glC, 85)},${depth}`
      : depth);
  }

  /* ---- sound ----
     s.snd may be a stored id, a direct URL, or a data URI (local preview). */
  function soundSrc() {
    const v = String(s.snd || '').trim();
    if (!v) return '';
    if (/^(https?:|data:|blob:)/i.test(v)) return v;
    return '/api/sound?id=' + encodeURIComponent(v);
  }
  let audioEl = null, audioSrc = '';
  function playSound() {
    const src = soundSrc();
    if (!src) return;
    try {
      if (audioSrc !== src) { audioEl = new Audio(src); audioSrc = src; }
      audioEl.volume = clamp(s.vol, 0, 100) / 100;
      audioEl.currentTime = 0;
      audioEl.play().catch(() => {});
    } catch {}
  }

  /* ---- counter: discrete slot ticks that slow to a stop, with milestones ---- */
  const MS = ['ms1', 'ms2', 'ms3', 'ms4', 'ms5'];
  let cntTimer = null;
  function milestone(el, lvl) {
    if (lvl < 1) return;
    lvl = Math.min(5, lvl);
    el.classList.remove(...MS); void el.offsetWidth;
    el.classList.add('ms' + lvl);
    if (lvl >= 3) {
      const body = document.querySelector('.bubble__body');
      if (body) { body.classList.remove('sh3', 'sh4', 'sh5'); void body.offsetWidth; body.classList.add('sh' + lvl); }
    }
  }
  function countUp(el, target) {
    clearTimeout(cntTimer);
    const total = Math.max(1, Math.round(target));
    el.textContent = '×1';
    if (total <= 1) { el.classList.add('landed'); return; }
    let i = 1;
    const finish = () => {
      el.classList.remove('tick', ...MS); void el.offsetWidth;
      el.classList.add('landed');
      milestone(el, Math.floor(total / 10));      /* final flourish scales with the total */
    };
    const tick = () => {
      i++;
      el.textContent = '×' + i;
      el.classList.remove('tick', 'landed', ...MS); void el.offsetWidth;
      if (i >= total) return finish();
      if (i % 10 === 0) milestone(el, i / 10);    /* every 10 -> a bigger flourish, capped at 50 */
      else el.classList.add('tick');
      const p = i / total;
      cntTimer = setTimeout(tick, 55 + Math.pow(p, 3) * 430);   /* fast first, slow at the end */
    };
    cntTimer = setTimeout(tick, 90);
  }

  /* ---- queue so alerts never overlap ---- */
  const queue = [];
  let busy = false;
  const ICONS = { crown: '--i-crown', gift: '--i-gift', heart: '--i-heart', follow: '--i-follow', bits: '--i-bits', coin: '--i-coin', star: '--i-star' };

  function show(kind, name, detail, num, numLabel) {
    if (!EVENTS.includes(kind)) return;
    const gate = kind === 'resub' ? 'sub' : kind;           /* resub follows the sub toggle */
    if (s[gate] !== '1' && s[kind] !== '1') return;
    queue.push({ kind, name, detail, num, numLabel });
    if (!busy) next();
  }
  function next() {
    const item = queue.shift();
    if (!item) { busy = false; return; }
    busy = true;
    const [icon, title] = PRESET[item.kind] || PRESET.sub;
    elIcon.style.setProperty('--icon', `var(${ICONS[icon] || '--i-crown'})`);
    elTitle.textContent = title;
    elMsg.textContent = item.name || 'Someone';

    const num = +item.num || 0;
    if (num > 1) {
      elDetail.innerHTML = `<span class="cnt">×1</span> ${esc(item.numLabel || '')}`;
    } else {
      elDetail.textContent = item.detail || '';
    }

    bubble.classList.remove('is-out', 'is-in');
    bubble.classList.add('is-on');
    void bubble.offsetWidth;
    bubble.classList.add('is-in');
    playSound();
    if (num > 1) setTimeout(() => { const c = elDetail.querySelector('.cnt'); if (c) countUp(c, num); }, 380);

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
    if (e.data.type === 'alert-sound') { playSound(); return; }
    if (e.data.type === 'alert-event') show(e.data.event, e.data.name, e.data.detail, e.data.num, e.data.numLabel);
  });

  apply();

  /* ---- optional on-screen status, for setting things up inside OBS ---- */
  const dbg = qs.get('debug') === '1';
  function status(t) {
    console.log('[sparklechat/alert]', t);
    if (!dbg) return;
    let el = document.querySelector('#diag');
    if (!el) { el = document.createElement('div'); el.id = 'diag'; document.body.appendChild(el); }
    el.textContent = t;
  }

  /* ---- demo loop: proves the source works in OBS while no real events happen ---- */
  if (s.demo === '1') {
    const reel = [
      ['sub', 'Mika', 'Tier 1', 0, ''],
      ['gift', 'Kaito', '×1', 5, 'GIFTS'],
      ['bits', 'LunaTV', '500 BITS', 0, ''],
      ['follow', 'はると', '', 0, ''],
      ['resub', 'ちゃんゆき', '', 12, 'MONTHS']
    ];
    let i = 0;
    const run = () => show(...reel[i++ % reel.length]);
    setTimeout(run, 800);
    setInterval(run, Math.max(4500, (clamp(s.dur, 1, 30) + 3) * 1000));
  }

  /* ---- real Twitch events over anonymous IRC ---- */
  const tier = p => p === 'Prime' ? 'PRIME' : p === '2000' ? 'Tier 2' : p === '3000' ? 'Tier 3' : 'Tier 1';
  const channel = String(s.channel || '').trim().toLowerCase();
  if (!channel) status('チャンネル名が未設定です（実際のイベントは受信しません）');
  if (channel && window.tmi) {
    status(`接続中… #${channel}`);
    const c = new window.tmi.Client({
      connection: { secure: true, reconnect: true },
      options: { skipMembership: true },
      channels: [channel]
    });
    c.on('subscription', (_ch, u, m) => show('sub', u, tier(m && m.plan), 0));
    c.on('resub', (_ch, u, months, _msg, _t, m) => show('resub', u, tier(m && m.plan), months, 'MONTHS'));
    c.on('subgift', (_ch, u, _s, r) => show('gift', u, r ? `→ ${r}` : '×1', 0));
    c.on('submysterygift', (_ch, u, n) => show('gift', u, '×1', n || 1, 'GIFTS'));
    c.on('cheer', (_ch, t) => show('bits', (t && (t['display-name'] || t.username)) || '', `${(t && t.bits) || 0} BITS`, 0));
    c.on('message', (_ch, t) => { if (t && t['custom-reward-id']) show('points', t['display-name'] || t.username, '', 0); });
    c.on('connected', () => status(`接続済み #${channel} · イベント待機中`));
    c.on('disconnected', why => status(`切断: ${why || '不明'}`));
    c.connect().catch(err => status(`接続エラー: ${err}`));
  }
})();
