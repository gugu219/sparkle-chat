/* SPARKLECHAT — Alert Overlay runtime.
   Settings arrive as URL params (OBS) or live via postMessage (editor preview). */
(() => {
  'use strict';

  const EVENTS = ['sub', 'resub', 'gift', 'follow', 'bits', 'points', 'donate', 'streak', 'hype'];

  /* icon key + English title. detail is built per event. */
  const PRESET = {
    sub:    ['crown',  'NEW SUB'],
    resub:  ['crown',  'RESUB'],
    gift:   ['gift',   'GIFT SUB'],
    follow: ['follow', 'NEW FOLLOWER'],
    bits:   ['bits',   'CHEER'],
    points: ['star',   'CHANNEL POINTS'],
    donate: ['coin',   'DONATION'],
    streak: ['flame',  'WATCH STREAK'],
    hype:   ['hype',   'HYPE TRAIN']
  };

  const DEFAULTS = {
    pos: 'bc', font: 'maru', anim: 'poyon', dur: '5', tail: '0',
    size: '26', radius: '100', pad: '22',
    txt: '#ffffff', acc: '#ff8fc5',
    ico: '#ffffff', icoBg: '#ff8fc5', icoBgA: '100',
    vol: '70',
    bg: '#181226', bgA: '62', blur: '14', glass: '140',
    brOn: '0', brC: '#ffffff', brW: '2', brA: '45',
    glOn: '0', glC: '#ff8fc5', glS: '40', glB: '40',
    sub: '1', resub: '1', gift: '1', follow: '1', bits: '1', points: '1', donate: '1', streak: '1', hype: '1',
    hypeX: '0', hypeY: '0', hypeScale: '100',
    demo: '0', channel: '', widget: ''
  };
  /* each event carries its own sound + volume + display time */
  EVENTS.forEach(e => { DEFAULTS[e + 'Snd'] = ''; DEFAULTS[e + 'Vol'] = '80'; DEFAULTS[e + 'Dur'] = '5'; });

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

    /* hype train panel: position offsets + size */
    root.style.setProperty('--hype-x', clamp(s.hypeX, -960, 960) + 'px');
    root.style.setProperty('--hype-y', clamp(s.hypeY, 0, 900) + 'px');
    root.style.setProperty('--hype-scale', (clamp(s.hypeScale, 50, 220) / 100).toFixed(3));

    /* glow + depth shadow */
    const depth = '0 12px 30px -14px rgba(10,5,20,.5)';
    root.style.setProperty('--shadow', s.glOn === '1'
      ? `0 0 ${clamp(s.glB, 0, 120)}px ${clamp(s.glS, 0, 100) / 4}px ${rgba(s.glC, 85)},${depth}`
      : depth);
  }

  /* ---- sound ----
     s[kind+'Snd'] may be a stored id, a direct URL, or a data URI (local preview). */
  function soundSrc(kind) {
    const v = String(s[kind + 'Snd'] || '').trim();
    if (!v) return '';
    if (/^(https?:|data:|blob:)/i.test(v)) return v;
    return '/api/sound?id=' + encodeURIComponent(v);
  }
  const audioCache = {};
  /* plays a user-supplied sound if one is set; returns true when it did */
  function playCustom(kind, onFailure = () => {}) {
    const src = soundSrc(kind);
    if (!src) return false;
    try {
      let a = audioCache[src];
      if (!a) { a = new Audio(src); audioCache[src] = a; }
      a.volume = (clamp(s[kind + 'Vol'], 0, 100) / 100) * (clamp(s.vol, 0, 100) / 100);
      a.currentTime = 0;
      a.play().catch(error => { console.warn('[sparklechat] custom alert sound failed', error); onFailure(); });
    } catch (error) { console.warn('[sparklechat] custom alert sound failed', error); return false; }
    return true;
  }

  /* ---- 8-bit chiptune for watch streaks (procedural, no files) ---- */
  const AC = { ctx: null, master: null };
  function ac() {
    if (AC.ctx === null) {
      try { AC.ctx = new (window.AudioContext || window.webkitAudioContext)(); AC.master = AC.ctx.createGain(); AC.master.connect(AC.ctx.destination); }
      catch { AC.ctx = false; }
    }
    if (AC.ctx && AC.ctx.state === 'suspended') AC.ctx.resume();
    return AC.ctx || null;
  }
  addEventListener('pointerdown', ac, { once: true });   /* unlock audio in a browser tab (OBS plays from the start) */
  addEventListener('keydown', ac, { once: true });
  function tone(freq, dur, o = {}) {
    const a = ac(); if (!a) return;
    const t0 = a.currentTime + (o.delay || 0), osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'square'; osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime((o.vol || 1) * .5, t0 + .008);
    g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
    osc.connect(g); g.connect(AC.master); osc.start(t0); osc.stop(t0 + dur + .05);
  }
  const chord = (fs, dur, o) => fs.forEach(f => tone(f, dur, o));
  const NT = { C5:523,D5:587,E5:659,F5:698,G5:784,A5:880,B5:988,Cs6:1109,C6:1046,D6:1175,E6:1318,F6:1397,G6:1568,A6:1760,C7:2093,E7:2637 };
  const chipVol = (kind = 'streak') => { if (ac()) AC.master.gain.value = (clamp(s[kind + 'Vol'], 0, 100) / 100) * (clamp(s.vol, 0, 100) / 100) * .6; };
  const streakRank = d => d >= 400 ? 11 : d >= 300 ? 10 : d >= 250 ? 9 : d >= 200 ? 8 : d >= 150 ? 7 : d >= 100 ? 6 : d >= 75 ? 5 : d >= 50 ? 4 : d >= 25 ? 3 : d >= 10 ? 2 : 1;

  /* per-event escalation tiers (1..5) — richer sound & flashier FX as the number climbs */
  const subRank  = m => m >= 24 ? 5 : m >= 12 ? 4 : m >= 6 ? 3 : m >= 3 ? 2 : 1;
  const bitsRank = b => b >= 10000 ? 5 : b >= 5000 ? 4 : b >= 1000 ? 3 : b >= 100 ? 2 : 1;
  const giftRank = n => n >= 50 ? 5 : n >= 20 ? 4 : n >= 10 ? 3 : n >= 5 ? 2 : 1;

  /* ---- original procedural sounds (no audio files) — escalate with the tier ---- */
  function sndSub(months, hiTier) {
    const lvl = subRank(months);
    [NT.C5, NT.E5, NT.G5, NT.C6].forEach((f, i) => tone(f, .13, { delay: i * .065, vol: .6 }));
    const t = .28;
    chord([NT.C5, NT.E5, NT.G5], .3, { delay: t, vol: .55 });
    if (lvl >= 2) chord([NT.C6, NT.E6, NT.G6], .3, { delay: t, vol: .28, type: 'triangle' });
    if (lvl >= 3) [NT.E6, NT.G6, NT.C7].forEach((f, i) => tone(f, .1, { delay: t + .18 + i * .07, vol: .3, type: 'triangle' }));
    if (lvl >= 4) chord([NT.G5, NT.B5, NT.D6, NT.G6], .4, { delay: t + .32, vol: .5 });
    if (lvl >= 5) chord([NT.C6, NT.E6, NT.G6, NT.C7], .6, { delay: t + .58, vol: .55 });
    if (hiTier) [NT.C7, NT.E7, NT.G6, NT.C7, NT.E7].forEach((f, i) => tone(f, .08, { delay: .12 + i * .09, vol: .18, type: 'triangle' }));
  }
  /* a single bright metallic coin "chari-n" */
  function coin(delay, vol) {
    tone(2490, .07, { delay, vol: vol * .5, type: 'triangle' });
    tone(3140, .11, { delay: delay + .022, vol: vol * .6, type: 'triangle' });
    tone(4180, .09, { delay: delay + .036, vol: vol * .32, type: 'sine' });
    tone(6280, .05, { delay: delay + .05, vol: vol * .14, type: 'sine' });
  }
  function sndBits(bits) {
    const lvl = bitsRank(bits), n = [1, 2, 4, 6, 9][lvl - 1];
    for (let i = 0; i < n; i++) coin(i * .09, .78 - i * .03);  /* coins raining, more as the amount climbs */
    const end = n * .09;
    if (lvl >= 3) { coin(end + .04, .9); coin(end + .17, 1); } /* cash-register cha-ching */
    if (lvl >= 4) chord([NT.C6, NT.E6, NT.G6], .3, { delay: end + .34, vol: .26, type: 'triangle' });
    if (lvl >= 5) [NT.G6, NT.C7, NT.E7].forEach((f, i) => tone(f, .12, { delay: end + .48 + i * .08, vol: .24, type: 'triangle' }));
  }
  function sndGift(count) {
    const lvl = giftRank(count);
    /* Short square-wave notes keep gifts recognizably electronic, even at 50+. */
    [NT.G5, NT.C6, NT.E6, NT.G6].forEach((f, i) => tone(f, .09, { delay: i * .075, vol: .68 }));
    [NT.C7, NT.E7].forEach((f, i) => tone(f, .1, { delay: .34 + i * .09, vol: .4, type: 'triangle' }));
    if (lvl >= 2) [NT.G6, NT.C7, NT.E7, NT.C7].forEach((f, i) => tone(f, .075, { delay: .55 + i * .07, vol: .5 }));
    if (lvl >= 3) [NT.E7, NT.C7, NT.G6].forEach((f, i) => tone(f, .07, { delay: .9 + i * .065, vol: .42 }));
    if (lvl >= 4) [NT.C7, NT.E7, NT.C7, NT.E7].forEach((f, i) => tone(f, .065, { delay: 1.15 + i * .06, vol: .36 }));
    if (lvl >= 5) tone(NT.E7, .22, { delay: 1.46, vol: .5, type: 'triangle' });
  }
  function sndHype(level) {
    [NT.C5, NT.E5, NT.G5, NT.C6].forEach((f, i) => tone(f, .12, { delay: i * .06, vol: .6 }));
    chord([NT.C6, NT.E6, NT.G6], .3, { delay: .28, vol: .5 });
    if (level >= 2) [NT.E6, NT.G6, NT.C7].forEach((f, i) => tone(f, .1, { delay: .42 + i * .07, vol: .32, type: 'triangle' }));
    if (level >= 3) chord([NT.G5, NT.B5, NT.D6, NT.G6], .4, { delay: .62, vol: .5 });
    if (level >= 5) chord([NT.C6, NT.E6, NT.G6, NT.C7], .6, { delay: .92, vol: .55 });
  }
  function sndFollow() { [NT.E5, NT.A5, NT.Cs6].forEach((f, i) => tone(f, .12, { delay: i * .07, vol: .5 })); }
  function sndPoints() { [NT.G5, NT.C6].forEach((f, i) => tone(f, .1, { delay: i * .06, vol: .45 })); tone(NT.E6, .12, { delay: .16, vol: .3, type: 'triangle' }); }
  function sndDonate() { [NT.C6, NT.G5, NT.C6, NT.E6].forEach((f, i) => tone(f, .12, { delay: i * .07, vol: .5 })); }

  /* route an event to its procedural sound (used when no custom sound is set) */
  function procSound(kind, mag, hiTier) {
    chipVol(kind);
    if (kind === 'sub' || kind === 'resub') sndSub(mag, hiTier);
    else if (kind === 'bits') sndBits(mag);
    else if (kind === 'gift') sndGift(mag);
    else if (kind === 'streak') chipAppear(streakRank(mag || 1));
    else if (kind === 'follow') sndFollow();
    else if (kind === 'points') sndPoints();
    else if (kind === 'donate') sndDonate();
  }

  /* ---- sparkle burst + rainbow frame ---- */
  const sparksHost = document.querySelector('#sparks');
  function spawnSparks(n, host) {
    host = host || sparksHost;
    if (!host || !n) return;
    host.textContent = '';
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'spark';
      el.textContent = i % 4 === 0 ? '✧' : '✦';
      const ang = Math.random() * Math.PI * 2, dist = 100 + Math.random() * 150;
      el.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      el.style.setProperty('--dy', (Math.sin(ang) * dist - 30).toFixed(0) + 'px');
      el.style.setProperty('--sz', (12 + Math.random() * 18).toFixed(0) + 'px');
      el.style.setProperty('--rot', (Math.random() * 360).toFixed(0) + 'deg');
      el.style.setProperty('--hue', (Math.random() * 360).toFixed(0));
      el.style.animationDelay = (Math.random() * .3).toFixed(2) + 's';
      host.appendChild(el);
    }
    clearTimeout(host._sparkClear);
    host._sparkClear = setTimeout(() => { host.textContent = ''; }, 2200);
  }
  /* decide the flourish for an event: how many sparks + whether the rainbow frame shows */
  function flourish(kind, mag, hiTier) {
    let sparks = 0, rainbow = false;
    if (kind === 'sub' || kind === 'resub') {
      rainbow = !!hiTier;
      sparks = mag >= 24 ? 20 : mag >= 12 ? 15 : mag >= 6 ? 11 : mag >= 3 ? 8 : 6;   /* even a plain sub sparkles */
      if (hiTier) sparks = Math.max(sparks, 16);              /* Tier 2/3 always sparkle harder */
    } else if (kind === 'bits') {
      sparks = mag >= 10000 ? 22 : mag >= 5000 ? 16 : mag >= 1000 ? 9 : mag >= 100 ? 4 : 0;
      rainbow = mag >= 10000;
    } else if (kind === 'gift') {                              /* 5 already flashy; 20+ adds the rainbow frame */
      sparks = mag >= 50 ? 26 : mag >= 20 ? 20 : mag >= 10 ? 13 : mag >= 5 ? 9 : 0;
      rainbow = mag >= 20;
    } else if (kind === 'streak') {
      const r = streakRank(mag);
      sparks = r >= 8 ? 20 : r >= 6 ? 12 : r >= 4 ? 5 : 0;
      rainbow = r >= 8;
    }
    bubble.classList.toggle('rainbow', rainbow);
    if (sparks) spawnSparks(sparks);
  }
  function chipAppear(r) {
    chipVol();
    if (r <= 1) [NT.C5, NT.G5].forEach((f, i) => tone(f, .11, { delay: i * .08, vol: .6 }));
    else if (r <= 3) [NT.C5, NT.E5, NT.G5].forEach((f, i) => tone(f, .12, { delay: i * .07, vol: .7 }));
    else [NT.C5, NT.E5, NT.G5, NT.C6].forEach((f, i) => tone(f, .12, { delay: i * .06, vol: .7 }));
  }
  function chipTick(big, r) {
    chipVol();
    const f = big ? NT.E6 : NT.B5;
    tone(f, .06, { vol: big ? .8 : .42 });
    if (r >= 5) tone(f * 1.5, .05, { vol: .18, type: 'triangle' });
  }
  function chipLand(r, days) {
    chipVol();
    if (days >= 100 && days % 100 === 0) {                     /* grand milestone fanfare */
      [NT.C5, NT.E5, NT.G5, NT.C6, NT.E6, NT.G6].forEach((f, i) => tone(f, .07, { delay: i * .045, vol: .6 }));
      chord([NT.C5, NT.E5, NT.G5, NT.C6], .12, { delay: .3, vol: .7 });
      chord([NT.F5, NT.A5, NT.C6, NT.F6], .18, { delay: .45, vol: .72 });
      chord([NT.G5, NT.B5, NT.D6, NT.G6], .18, { delay: .63, vol: .75 });
      chord([NT.C5, NT.G5, NT.C6, NT.E6, NT.G6], .7, { delay: .82, vol: .8 });
      [NT.C7, NT.E7, NT.G6, NT.C7].forEach((f, i) => tone(f, .09, { delay: .9 + i * .08, vol: .3, type: 'triangle' }));
      return;
    }
    if (r <= 1) [NT.A5, NT.Cs6].forEach((f, i) => tone(f, .13, { delay: i * .09, vol: .7 }));
    else if (r <= 3) [NT.A5, NT.Cs6, NT.E6].forEach((f, i) => tone(f, .14, { delay: i * .08, vol: .8 }));
    else if (r <= 5) [NT.G5, NT.B5, NT.D6, NT.G6].forEach((f, i) => tone(f, .16, { delay: i * .09, vol: .85 }));
    else {
      [NT.G5, NT.B5, NT.D6, NT.G6].forEach((f, i) => { tone(f, .16, { delay: i * .08, vol: .9 }); tone(f * 1.5, .13, { delay: i * .08, vol: .22, type: 'triangle' }); });
      chord([NT.C6, NT.E6, NT.G6], .35, { delay: .4, vol: .55 });
      [NT.C7, NT.A6, NT.C7].forEach((f, i) => tone(f, .08, { delay: .48 + i * .07, vol: .32, type: 'triangle' }));
    }
  }

  /* ---- streak count-up: time-based (handles big numbers), pulses & sounds every 10 ---- */
  function countUpStreak(el, target) {
    clearTimeout(cntTimer);
    const total = Math.max(1, Math.round(target)), r = streakRank(total);
    el.textContent = '1';
    if (total <= 1) { el.classList.add('landed'); if (sfxOn) chipLand(r, total); return; }
    const dur = Math.min(3000, 900 + total * 8), t0 = Date.now();
    let last = 1;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      const val = Math.max(1, Math.round(total * (1 - Math.pow(1 - p, 3))));
      if (val !== last) {
        el.textContent = String(val);
        if (Math.floor(val / 10) > Math.floor(last / 10)) {
          const big = Math.floor(val / 100) > Math.floor(last / 100);
          milestone(el, big ? 5 : Math.min(4, Math.floor(val / 50) + 1));
          if (sfxOn) chipTick(big, r);
        }
        last = val;
      }
      if (p < 1) cntTimer = setTimeout(step, 45);
      else { el.classList.remove(...MS); void el.offsetWidth; el.classList.add('landed'); milestone(el, Math.min(5, Math.floor(total / 25) + 1)); if (sfxOn) chipLand(r, total); }
    };
    cntTimer = setTimeout(step, 45);
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
  function countUp(el, target, prefix) {
    prefix = prefix != null ? prefix : '×';
    clearTimeout(cntTimer);
    const total = Math.max(1, Math.round(target));
    el.textContent = prefix + '1';
    if (total <= 1) { el.classList.add('landed'); return; }
    let i = 1;
    const finish = () => {
      el.classList.remove('tick', ...MS); void el.offsetWidth;
      el.classList.add('landed');
      milestone(el, Math.floor(total / 10));      /* final flourish scales with the total */
    };
    const tick = () => {
      i++;
      el.textContent = prefix + i;
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
  let sfxOn = true;                                          /* true when procedural sound is in use (no custom file) */
  const ICONS = { crown: '--i-crown', gift: '--i-gift', heart: '--i-heart', follow: '--i-follow', bits: '--i-bits', coin: '--i-coin', star: '--i-star', flame: '--i-flame', hype: '--i-hype' };

  function show(kind, name, detail, num, numLabel, numPrefix, mag) {
    if (!EVENTS.includes(kind)) return;
    const gate = kind === 'resub' ? 'sub' : kind;           /* resub follows the sub toggle */
    if (s[gate] !== '1' && s[kind] !== '1') return;
    queue.push({ kind, name, detail, num, numLabel, numPrefix, mag });
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
    const prefix = item.numPrefix != null ? item.numPrefix : '×';
    root.style.setProperty('--alert-dur', clamp(s[item.kind + 'Dur'] || s.dur, 1, 30) + 's');
    if (num > 1) {
      elDetail.innerHTML = `<span class="cnt">${esc(prefix)}1</span> ${esc(item.numLabel || '')}`;
    } else {
      elDetail.textContent = item.detail || '';
    }

    /* magnitude drives the sound tier + the flourish; bits carries it in the detail text */
    let mag = item.mag;
    if (mag == null) {
      if (item.kind === 'bits') { const mm = String(item.detail || '').match(/[\d,]+/); mag = mm ? +mm[0].replace(/,/g, '') : 1; }
      else mag = num > 1 ? num : 1;
    }
    const hiTier = /tier\s*[23]/i.test(String(item.detail || ''));

    bubble.classList.remove('is-out', 'is-in', 'rainbow', 'tier2', 'tier3');
    /* new-sub tier badge gets a natural emphasis (resub shows a counter instead) */
    if (item.kind === 'sub') {
      if (/tier\s*3/i.test(String(item.detail || ''))) bubble.classList.add('tier3');
      else if (/tier\s*2/i.test(String(item.detail || ''))) bubble.classList.add('tier2');
    }
    bubble.classList.add('is-on');
    void bubble.offsetWidth;
    bubble.classList.add('is-in');

    sfxOn = !playCustom(item.kind, () => procSound(item.kind, mag, hiTier));
    if (sfxOn) procSound(item.kind, mag, hiTier);
    flourish(item.kind, mag, hiTier);

    if (num > 1) setTimeout(() => {
      const c = elDetail.querySelector('.cnt'); if (!c) return;
      if (item.kind === 'streak') countUpStreak(c, num);
      else countUp(c, num, prefix);
    }, 380);

    const hold = clamp(s[item.kind + 'Dur'] || s.dur, 1, 30) * 1000;
    setTimeout(() => {
      bubble.classList.remove('is-in');
      bubble.classList.add('is-out');
      setTimeout(() => {
        bubble.classList.remove('is-on', 'is-out', 'rainbow', 'tier2', 'tier3');
        if (sparksHost) sparksHost.textContent = '';
        next();
      }, 360);
    }, hold);
  }

  /* ---- hype train: live self-updating panel (level + progress% + countdown) ---- */
  const hype = document.querySelector('#hype');
  const hypeLvl = document.querySelector('#hype-lvl');
  const hypePct = document.querySelector('#hype-pct');
  const hypeTimer = document.querySelector('#hype-timer');
  const hypeFill = document.querySelector('#hype-fill');
  const hypeTimeFill = document.querySelector('#hype-timefill');
  const hypeSparks = document.querySelector('#hype-sparks');
  let hypeState = null, hypeTick = null, hypeOutT = null, hypeDone = false;
  const fmtT = sec => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  const hypeSparkN = lvl => Math.min(34, Math.max(8, lvl * 7));   /* flashier every level */
  function hypeRender() {
    if (!hypeState) return;
    if (!hypeDone) hypeLvl.textContent = 'LEVEL ' + hypeState.level;
    hypePct.textContent = Math.round(hypeState.pct) + '%';
    hypeFill.style.width = clamp(hypeState.pct, 0, 100) + '%';
    const remain = (hypeState.expires - Date.now()) / 1000;
    hypeTimer.textContent = fmtT(remain);
    hypeTimeFill.style.width = clamp((remain / (hypeState.maxRemain || 300)) * 100, 0, 100) + '%';
  }
  function hypeHide() {
    clearInterval(hypeTick); hypeTick = null;
    hype.classList.add('is-out');
    hypeOutT = setTimeout(() => { hype.classList.remove('is-on', 'is-out', 'levelup'); hypeState = null; hypeDone = false; }, 500);
  }
  function hypeTickFn() {
    if (!hypeState) { clearInterval(hypeTick); hypeTick = null; return; }
    hypeRender();
    if ((hypeState.expires - Date.now()) / 1000 <= 0) hypeHide();     /* stay up until the countdown runs out */
  }
  function hypeUpdate(e) {
    if (s.hype !== '1') return;
    clearTimeout(hypeOutT);
    const level = +e.level || 1;
    const pct = e.goal ? (100 * (+e.progress || 0) / (+e.goal || 1)) : 0;
    const expires = e.expires_at ? Date.parse(e.expires_at) : Date.now() + 300000;
    const remainNow = (expires - Date.now()) / 1000;
    const prev = hypeState;
    const maxRemain = prev ? Math.max(prev.maxRemain, remainNow) : Math.max(remainNow, 1);
    hypeState = { level, pct, expires, maxRemain };
    hype.classList.remove('is-out');
    if (!prev) {                                                     /* begin */
      hypeDone = false; hype.classList.add('is-on');
      spawnSparks(8, hypeSparks);
      if (!playCustom('hype', () => { chipVol('hype'); sndHype(level); })) { chipVol('hype'); sndHype(level); }
    } else if (level > prev.level) {                                 /* level up — more sparkles the higher it goes */
      hype.classList.remove('levelup'); void hype.offsetWidth; hype.classList.add('levelup');
      spawnSparks(hypeSparkN(level), hypeSparks);
      if (!playCustom('hype', () => { chipVol('hype'); sndHype(level); })) { chipVol('hype'); sndHype(level); }
    }
    hypeRender();
    if (!hypeTick) hypeTick = setInterval(hypeTickFn, 500);
  }
  const hypeBegin = e => hypeUpdate(e);
  const hypeProgress = e => hypeUpdate(e);
  function hypeEnd(e) {                                              /* mark complete but keep it visible until the timer hits 0 */
    if (!hypeState) return;
    hypeDone = true;
    hypeState.pct = 100; hypeRender();
    hypeLvl.textContent = 'LEVEL ' + (+(e && e.level) || hypeState.level) + ' 完走!';
    spawnSparks(hypeSparkN(hypeState.level), hypeSparks);
    if (!hypeTick) hypeTick = setInterval(hypeTickFn, 500);
  }
  function hypeTestRun() {
    const now = Date.now(), exp = t => new Date(now + t).toISOString();
    hypeBegin({ level: 1, progress: 260, goal: 500, expires_at: exp(13000) });
    setTimeout(() => hypeProgress({ level: 2, progress: 300, goal: 800, expires_at: exp(13000) }), 2200);
    setTimeout(() => hypeProgress({ level: 3, progress: 500, goal: 900, expires_at: exp(13000) }), 4600);
    setTimeout(() => hypeProgress({ level: 4, progress: 820, goal: 1000, expires_at: exp(13000) }), 7000);
    setTimeout(() => hypeEnd({ level: 4 }), 9500);   /* completes, but the panel stays until the timer reaches 0 */
  }

  /* ---- live settings + test events from the editor ---- */
  window.addEventListener('message', e => {
    if(e.origin!==location.origin||e.source!==parent||e.data?.source !== 'prism-editor') return;
    if (e.data.type === 'alert-settings') { Object.assign(s, e.data.settings || {}); apply(); return; }
    if (e.data.type === 'alert-hype-test') { hypeTestRun(); return; }
    if (e.data.type === 'alert-sound') {
      const k = e.data.event || 'sub';
      const pm = { sub: 12, resub: 12, bits: 1000, gift: 10, streak: 50 }[k] || 1;
      if (!playCustom(k, () => procSound(k, pm, k === 'sub' || k === 'resub'))) procSound(k, pm, k === 'sub' || k === 'resub');
      return;
    }
    if (e.data.type === 'alert-event') show(e.data.event, e.data.name, e.data.detail, e.data.num, e.data.numLabel, e.data.numPrefix);
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
      ['resub', 'ちゃんゆき', '', 12, 'MONTHS'],
      ['streak', 'guguttemy_fan', '', 25, '回', '']
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
  if (channel && window.tmi && !qs.has('preview') && !qs.has('overlay')) {
    status(`接続中… #${channel}`);
    const c = new window.tmi.Client({
      connection: { secure: true, reconnect: true },
      options: { skipMembership: true },
      channels: [channel]
    });
    c.on('subscription', (_ch, u, m) => show('sub', u, tier(m && m.plan), 0));
    c.on('resub', (_ch, u, months, _msg, _t, m) => show('resub', u, tier(m && m.plan), months, 'MONTHS'));
    /* Bulk (mystery) gifts fire one summary event + one subgift per recipient.
       Announce the bulk once and swallow the individual gifts; a lone gift still
       shows sender -> recipient. */
    const giftHush = {}, giftHushT = {};
    c.on('submysterygift', (_ch, u, n) => {
      const count = Math.max(1, +n || 1);
      if (count < 2) return;                                   /* a single gift is shown as sender -> recipient */
      giftHush[u] = (giftHush[u] || 0) + count;
      clearTimeout(giftHushT[u]);
      giftHushT[u] = setTimeout(() => { delete giftHush[u]; }, 90000);
      show('gift', u, '×1', count, 'GIFTS');
    });
    c.on('subgift', (_ch, u, _s, r) => {
      if (giftHush[u] > 0) { if (--giftHush[u] <= 0) { delete giftHush[u]; clearTimeout(giftHushT[u]); } return; }
      show('gift', u, r ? `→ ${r}` : '×1', 0);
    });
    c.on('cheer', (_ch, t) => show('bits', (t && (t['display-name'] || t.username)) || '', `${(t && t.bits) || 0} BITS`, 0));

    /* watch streaks: official viewermilestone (most reliable) + JP/EN text reposts */
    const toHalf = x => String(x).replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    const reJP = /([^\s　！!？?。、,，]+)\s*さんは\s*(?:現在)?\s*[、,]?\s*([0-9０-９,，]+)\s*日?\s*(?:連続視聴|日連続視聴)中/;
    const reEN = /(\S+)\s+watched\s+([\d,]+)\s+consecutive\s+streams/i;
    const streakShow = (name, days) => {
      name = String(name || '').trim();
      days = parseInt(String(days).replace(/[,，]/g, ''), 10);
      if (name && days > 0) show('streak', name, '', days, '回', '');
    };
    c.on('message', (_ch, t, text) => {
      if (t && t['custom-reward-id']) show('points', t['display-name'] || t.username, '', 0);
    });
    c.on('raw_message', (_cloned, msg) => {
      const tg = msg && msg.tags;
      if (tg && msg.command === 'USERNOTICE' && tg['msg-id'] === 'viewermilestone'
          && (tg['msg-param-category'] || 'watch-streak') === 'watch-streak') {
        streakShow(tg['display-name'] || tg['login'], tg['msg-param-value']);
      }
    });
    c.on('connected', () => status(`接続済み #${channel} · イベント待機中`));
    c.on('disconnected', why => status(`切断: ${why || '不明'}`));
    c.connect().catch(err => status(`接続エラー: ${err}`));
  }

  window.addEventListener('sparkle-events',event=>{
    const p=event.detail;
    for(const e of p.events||[]){
      if(e.type==='hype'){if(s.hype==='1'){if(e.phase==='end')hypeEnd(e.hype);else hypeUpdate(e.hype);}continue;}
      const k=e.type==='donation'?'donate':e.type;if(!EVENTS.includes(k))continue;
      let detail=e.message||'';if(k==='donate')detail=[e.amount,e.currency,e.message].filter(x=>x!==null&&x!==undefined).join(' ');
      if(k==='bits')detail=(e.amount||0)+' BITS';if(e.tier)detail='Tier '+({'1000':1,'2000':2,'3000':3}[e.tier]||e.tier);
      show(k,e.name,detail,k==='streak'||k==='gift'?e.count:k==='resub'?e.months:0,k==='streak'?'連続視聴':k==='resub'?'MONTHS':'GIFTS',k==='streak'?'':'×');
    }
    if(p.hype&&s.hype==='1'&&!hypeState&&p.hype.phase!=='end'&&Date.parse(p.hype.hype.expires_at)>Date.now())hypeUpdate(p.hype.hype);
  });
})();
