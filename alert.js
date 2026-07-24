/* SPARKLECHAT — Alert Overlay runtime.
   Settings arrive as URL params (OBS) or live via postMessage (editor preview). */
(() => {
  'use strict';

  const EVENTS = ['sub', 'resub', 'gift', 'follow', 'bits', 'points', 'donate', 'streak'];

  /* icon key + English title. detail is built per event. */
  const PRESET = {
    sub:    ['crown',  'NEW SUB'],
    resub:  ['crown',  'RESUB'],
    gift:   ['gift',   'GIFT SUB'],
    follow: ['follow', 'NEW FOLLOWER'],
    bits:   ['bits',   'CHEER'],
    points: ['star',   'CHANNEL POINTS'],
    donate: ['coin',   'DONATION'],
    streak: ['flame',  'WATCH STREAK']
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
    sub: '1', resub: '1', gift: '1', follow: '1', bits: '1', points: '1', donate: '1', streak: '1',
    demo: '0', channel: ''
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
  function playSound(kind) {
    const src = soundSrc(kind);
    if (!src) return;
    try {
      let a = audioCache[src];
      if (!a) { a = new Audio(src); audioCache[src] = a; }
      a.volume = (clamp(s[kind + 'Vol'], 0, 100) / 100) * (clamp(s.vol, 0, 100) / 100);
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
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
  const chipVol = () => { if (ac()) AC.master.gain.value = (clamp(s.streakVol, 0, 100) / 100) * (clamp(s.vol, 0, 100) / 100) * .6; };
  const streakRank = d => d >= 400 ? 11 : d >= 300 ? 10 : d >= 250 ? 9 : d >= 200 ? 8 : d >= 150 ? 7 : d >= 100 ? 6 : d >= 75 ? 5 : d >= 50 ? 4 : d >= 25 ? 3 : d >= 10 ? 2 : 1;
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
    if (total <= 1) { el.classList.add('landed'); chipLand(r, total); return; }
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
          chipTick(big, r);
        }
        last = val;
      }
      if (p < 1) cntTimer = setTimeout(step, 45);
      else { el.classList.remove(...MS); void el.offsetWidth; el.classList.add('landed'); milestone(el, Math.min(5, Math.floor(total / 25) + 1)); chipLand(r, total); }
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
  const ICONS = { crown: '--i-crown', gift: '--i-gift', heart: '--i-heart', follow: '--i-follow', bits: '--i-bits', coin: '--i-coin', star: '--i-star', flame: '--i-flame' };

  function show(kind, name, detail, num, numLabel, numPrefix) {
    if (!EVENTS.includes(kind)) return;
    const gate = kind === 'resub' ? 'sub' : kind;           /* resub follows the sub toggle */
    if (s[gate] !== '1' && s[kind] !== '1') return;
    queue.push({ kind, name, detail, num, numLabel, numPrefix });
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
    if (num > 1) {
      elDetail.innerHTML = `<span class="cnt">${esc(prefix)}1</span> ${esc(item.numLabel || '')}`;
    } else {
      elDetail.textContent = item.detail || '';
    }

    bubble.classList.remove('is-out', 'is-in');
    bubble.classList.add('is-on');
    void bubble.offsetWidth;
    bubble.classList.add('is-in');
    playSound(item.kind);
    if (item.kind === 'streak') chipAppear(streakRank(num || 1));
    if (num > 1) setTimeout(() => {
      const c = elDetail.querySelector('.cnt'); if (!c) return;
      if (item.kind === 'streak') countUpStreak(c, num);
      else countUp(c, num, prefix);
    }, 380);

    const hold = clamp(s[item.kind + 'Dur'] || s.dur, 1, 30) * 1000;
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
    if (e.data.type === 'alert-sound') { playSound(e.data.event || 'sub'); return; }
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
  if (channel && window.tmi) {
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
      if (!text) return;
      let m = text.match(reEN); if (m) return streakShow(m[1], m[2]);
      m = text.match(reJP);     if (m) return streakShow(m[1], toHalf(m[2]));
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
})();
