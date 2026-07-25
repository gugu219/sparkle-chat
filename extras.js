/* SPARKLECHAT — Telop / Slideshow / hourly-chime overlay runtime.
   Settings arrive as URL params (OBS) or live via postMessage (editor preview). */
(() => {
  'use strict';

  const FONTS = ['maru', 'rounded', 'kaku', 'noto', 'poppins', 'dot'];
  const SPOS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

  const DEFAULTS = {
    tOn: '1', tFont: 'maru', tBg: '#181226', tBgA: '72', tAnchor: 'bot', tX: '0', tY: '0', tSize: '26', tSpeed: '90',
    sOn: '0', sPos: 'br', sW: '420', sShadow: '1', sShd: '24', sFade: '0.6', sCool: '30',
    chOn: '0', chSnd: '', chVol: '80', vol: '90',
    telops: '[]', slides: '[]'
  };

  const qs = new URLSearchParams(location.search);
  let s = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, qs.get(k) ?? DEFAULTS[k]]));

  const root = document.documentElement;
  const telop = document.querySelector('#telop');
  const telLabel = document.querySelector('#telop-label');
  const telView = document.querySelector('#telop-view');
  const telText = document.querySelector('#telop-text');
  const slide = document.querySelector('#slide');
  const slideImg = document.querySelector('#slide-img');

  const clamp = (v, lo, hi) => { const n = parseFloat(v); return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo)); };
  const hex = (v, fb) => { const h = String(v || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6); return h.length === 6 ? '#' + h : fb; };
  const rgba = (h, a) => { const c = hex(h, '#181226').slice(1), n = parseInt(c, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${(clamp(a, 0, 100) / 100).toFixed(3)})`; };
  const on = v => v === '1' || v === true;
  const parseArr = v => { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } };
  const telops = () => parseArr(s.telops).filter(x => x && String(x.t || '').trim());
  const slides = () => parseArr(s.slides).filter(x => x && String(x.i || '').trim());

  /* ---- media sources: stored id, direct URL, or data URI ---- */
  const sndSrc = v => { v = String(v || '').trim(); return !v ? '' : /^(https?:|data:|blob:)/i.test(v) ? v : '/api/sound?id=' + encodeURIComponent(v); };
  const imgSrc = v => { v = String(v || '').trim(); return !v ? '' : /^(https?:|data:|blob:)/i.test(v) ? v : '/api/image?id=' + encodeURIComponent(v); };
  const audioCache = {};
  function playSound(v, vol) {
    const src = sndSrc(v); if (!src) return;
    try { let a = audioCache[src]; if (!a) { a = new Audio(src); audioCache[src] = a; } a.volume = clamp(vol, 0, 100) / 100; a.currentTime = 0; a.play().catch(() => {}); } catch {}
  }

  function apply() {
    document.body.className = 'font-' + (FONTS.includes(s.tFont) ? s.tFont : 'maru');
    root.style.setProperty('--t-bg', rgba(s.tBg, s.tBgA));
    root.style.setProperty('--t-size', clamp(s.tSize, 12, 60) + 'px');
    root.style.setProperty('--t-x', clamp(s.tX, -960, 960) + 'px');
    root.style.setProperty('--t-y', clamp(s.tY, 0, 940) + 'px');
    ['anchor-top', 'anchor-bot'].forEach(c => telop.classList.remove(c));
    telop.classList.add(s.tAnchor === 'top' ? 'anchor-top' : 'anchor-bot');

    SPOS.forEach(p => slide.classList.remove('sp-' + p));
    slide.classList.add('sp-' + (SPOS.includes(s.sPos) ? s.sPos : 'br'));
    slide.classList.toggle('shadow', on(s.sShadow));
    slide.style.width = clamp(s.sW, 80, 1920) + 'px';
    root.style.setProperty('--s-fade', clamp(s.sFade, 0, 3) + 's');
    root.style.setProperty('--s-shd', clamp(s.sShd, 0, 80) + 'px');
  }

  /* ---- telop: rotate up to 5 messages, scroll each right-to-left ---- */
  let telIdx = 0, telRAF = null, telSwitchT = null, telX = 0;
  function stopTelop() { cancelAnimationFrame(telRAF); clearTimeout(telSwitchT); }
  function marquee() {
    cancelAnimationFrame(telRAF);
    const view = telView.clientWidth || 600;
    const speed = clamp(s.tSpeed, 15, 400);
    telX = view;
    let last = performance.now();
    const step = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      telX -= speed * dt;
      const tw = telText.scrollWidth;
      if (telX < -tw) telX = view;                 /* loop the same message */
      telText.style.transform = `translateX(${telX}px)`;
      telRAF = requestAnimationFrame(step);
    };
    telRAF = requestAnimationFrame(step);
  }
  function telApplyItem(item) {
    telLabel.textContent = item.n || '';
    telLabel.style.background = item.c ? hex(item.c, '#ff8fc5') : '';
    telText.textContent = item.t || '';
    marquee();
  }
  function telStart() {
    stopTelop();
    const list = telops();
    if (!on(s.tOn) || !list.length) { telop.classList.remove('is-on'); return; }
    telop.classList.add('is-on', 'fade');
    telIdx = telIdx % list.length;
    telApplyItem(list[telIdx]);
    if (list.length > 1) telSwitchT = setTimeout(telNext, Math.max(2, +list[telIdx].d || 8) * 1000);
  }
  function telNext() {
    const list = telops();
    if (!list.length) { telop.classList.remove('is-on'); return; }
    telop.classList.add('hide-content');
    setTimeout(() => {
      telIdx = (telIdx + 1) % list.length;
      telApplyItem(list[telIdx]);
      telop.classList.remove('hide-content');
      clearTimeout(telSwitchT);
      if (list.length > 1) telSwitchT = setTimeout(telNext, Math.max(2, +list[telIdx].d || 8) * 1000);
    }, 320);
  }

  /* ---- slideshow: fade each image, per-slide sound, hide for a cooldown after a full cycle ---- */
  let slIdx = 0, slT = null, slCoolT = null;
  function stopSlides() { clearTimeout(slT); clearTimeout(slCoolT); }
  function slStart() {
    stopSlides();
    slIdx = 0;
    const list = slides();
    if (!on(s.sOn) || !list.length) { slide.classList.remove('is-on', 'show'); return; }
    slShow();
  }
  function slShow() {
    const list = slides();
    if (!on(s.sOn) || !list.length) { slide.classList.remove('is-on', 'show'); return; }
    slIdx = slIdx % list.length;
    const item = list[slIdx];
    slideImg.src = imgSrc(item.i);
    if (item.s) playSound(item.s, s.vol);
    slide.classList.add('is-on');
    requestAnimationFrame(() => slide.classList.add('show'));
    clearTimeout(slT);
    slT = setTimeout(() => {
      slide.classList.remove('show');                       /* fade out */
      setTimeout(() => {
        slIdx++;
        if (slIdx >= list.length) {                          /* completed one full pass */
          slIdx = 0;
          const cool = clamp(s.sCool, 0, 720);
          if (cool > 0) { slide.classList.remove('is-on'); slCoolT = setTimeout(slShow, cool * 60000); return; }
        }
        slShow();
      }, clamp(s.sFade, 0, 3) * 1000 + 40);
    }, Math.max(1, +item.d || 6) * 1000);
  }

  /* ---- hourly chime: fire once when the clock reaches :00 ---- */
  let lastHour = new Date().getMinutes() === 0 ? new Date().getHours() : -1;
  setInterval(() => {
    if (!on(s.chOn)) return;
    const now = new Date();
    if (now.getMinutes() === 0 && now.getHours() !== lastHour) { lastHour = now.getHours(); if (s.chSnd) playSound(s.chSnd, s.chVol); }
    else if (now.getMinutes() !== 0 && lastHour !== -1 && now.getHours() !== lastHour) lastHour = -1;
  }, 1000);

  function restart() { apply(); telStart(); slStart(); }

  /* ---- live settings + test events from the editor ---- */
  window.addEventListener('message', e => {
    if (e.data?.source !== 'prism-editor') return;
    if (e.data.type === 'extras-settings') { Object.assign(s, e.data.settings || {}); restart(); return; }
    if (e.data.type === 'extras-telop-next') { telNext(); return; }
    if (e.data.type === 'extras-slide-next') { slIdx++; slShow(); return; }
    if (e.data.type === 'extras-chime') { if (s.chSnd) playSound(s.chSnd, s.chVol); return; }
    if (e.data.type === 'extras-sound') { playSound(e.data.snd, e.data.vol != null ? e.data.vol : s.vol); return; }
  });

  addEventListener('pointerdown', () => {}, { once: true });   /* a click unlocks audio in a browser tab (OBS autoplays) */

  restart();

  /* ---- optional on-screen status (&debug=1) ---- */
  if (qs.get('debug') === '1') {
    const el = document.createElement('div'); el.id = 'diag';
    el.textContent = `telop ${telops().length} / slides ${slides().length} / chime ${on(s.chOn) ? 'on' : 'off'}`;
    document.body.appendChild(el);
  }
})();
