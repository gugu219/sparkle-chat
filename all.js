/* SPARKLECHAT — Combined overlay: stacks all four overlays in ONE OBS browser source.
   Config arrives as ?id=<stored> (fetched from /api/config) or ?c=<inline JSON>. */
(async () => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  let cfg = null;

  const idp = qs.get('id');
  if (idp) { try { const r = await fetch('/api/config?id=' + encodeURIComponent(idp)); if (r.ok) cfg = await r.json(); } catch {} }
  if (!cfg) { const c = qs.get('c'); if (c) { try { cfg = JSON.parse(decodeURIComponent(c)); } catch {} } }
  cfg = cfg && typeof cfg === 'object' ? cfg : {};

  const channel = String(cfg.channel || '').trim();
  const FILE = { frame: 'frame.html', extras: 'extras.html', chat: 'view.html', alert: 'alert.html' };
  /* paint order = z-index: frame at the back, then telop/slides, chat, alerts on top */
  const ORDER = ['frame', 'extras', 'chat', 'alert'];

  let n = 0;
  ORDER.forEach((name, i) => {
    const params = cfg[name];
    if (!params || typeof params !== 'object') return;
    const p = new URLSearchParams(params);
    if (channel && name !== 'extras') p.set('channel', channel);   /* one account drives chat/frame/alert */
    const f = document.createElement('iframe');
    f.className = 'ov';
    f.style.zIndex = String(i + 1);
    f.setAttribute('scrolling', 'no');
    f.src = FILE[name] + '?' + p.toString();
    document.body.appendChild(f);
    n++;
  });

  if (qs.get('debug') === '1') {
    const el = document.createElement('div'); el.id = 'diag';
    el.textContent = `combined: ${n} overlays · #${channel || '(no channel)'}`;
    document.body.appendChild(el);
  }
})();
