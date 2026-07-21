(() => {
  'use strict';
  const page = document.documentElement.dataset.page;
  const defaults = { channel:'', theme:'selene', font:'zen', bg:'glass', opacity:'78', textSize:'15', limit:'12', blur:'1' };
  const params = new URLSearchParams(location.search);
  const getSettings = () => Object.fromEntries(Object.keys(defaults).map(key => [key, params.get(key) ?? defaults[key]]));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const nameColor = name => { let n=0; for(const char of String(name || 'viewer')) n=(n*31+char.charCodeAt(0))%360; return `hsl(${n} 82% 77%)`; };

  function applyTheme(settings) {
    const body = document.body; body.classList.remove('theme-selene','theme-rose','theme-aurora','bg-glass','bg-clear','bg-black','font-zen','font-rounded','font-system','use-blur');
    body.classList.add(`theme-${settings.theme}`, `bg-${settings.bg}`, `font-${settings.font}`);
    if (settings.blur === '1') body.classList.add('use-blur');
    document.documentElement.style.setProperty('--bubble-opacity', Math.min(1, Math.max(.25, Number(settings.opacity) / 100)));
    document.documentElement.style.setProperty('--text-size', `${Math.min(22,Math.max(12,Number(settings.textSize)))}px`);
    document.documentElement.style.setProperty('--body-font', settings.font === 'rounded' ? '"M PLUS Rounded 1c", sans-serif' : settings.font === 'system' ? 'system-ui, sans-serif' : '"Zen Kaku Gothic New", sans-serif');
  }

  function startView() {
    const settings = getSettings(); applyTheme(settings);
    const chat = document.querySelector('#chat'); const messageTpl = document.querySelector('#message-template'); const alertTpl = document.querySelector('#alert-template');
    const limit = Math.max(1, Number(settings.limit) || 12);
    const trim = () => { while(chat.childElementCount > limit) { const el=chat.lastElementChild; el.classList.add('is-leaving'); setTimeout(()=>el.remove(),310); if(chat.childElementCount<=limit+1) break; el.remove(); } };
    const role = tags => { const b=tags.badges||''; if(b.includes('broadcaster'))return['broadcaster','配信者'];if(b.includes('moderator')||tags.mod==='1')return['mod','MOD'];if(b.includes('vip'))return['vip','VIP'];if(b.includes('subscriber')||tags.subscriber==='1')return['sub','SUB'];return['','']; };
    const message = (name, text, tags={}) => { const f=messageTpl.content.cloneNode(true); const [kind,label]=role(tags); const badge=f.querySelector('.role-badge'); if(kind){badge.classList.add(`badge-${kind}`);badge.textContent=label;} const user=f.querySelector('.chat-message__name');user.textContent=name||'Viewer';user.style.setProperty('--user-color',tags.color||nameColor(name));f.querySelector('.chat-message__bubble').textContent=text||'';chat.prepend(f);trim(); };
    const alert = (type, label, name, amount='', note='') => { const f=alertTpl.content.cloneNode(true); const box=f.querySelector('.chat-alert__border');box.classList.add(`alert-${type}`);f.querySelector('.chat-alert__kind').textContent=label;f.querySelector('.chat-alert__line').innerHTML=`<span class="a-name">${escapeHtml(name||'Anonymous')}</span> さん${amount?` <span class="a-amount">${escapeHtml(amount)}</span>`:''}`;const noteEl=f.querySelector('.chat-alert__note');noteEl.textContent=note||'';if(!noteEl.textContent)noteEl.remove();chat.prepend(f);trim(); };
    window.addEventListener('message', event => { if(event.data?.source !== 'prism-editor')return; const demos={message:()=>message('星見ミカ','最高のシーン！ 今日も配信ありがとう ✨',{badges:'subscriber/6',subscriber:'1',color:'#d6a3ff'}),sub:()=>alert('sub','NEW SUBSCRIBER','mikan_tea','','メンバーになりました！'),cheer:()=>alert('cheer','CHEER','Kenta','500 Bits','ナイスプレイ！'),tip:()=>alert('tip','TIP','Rin','¥500','応援しています！')};demos[event.data.type]?.(); });
    if (params.has('preview')) { document.body.classList.add('is-preview'); document.querySelector('#preview-channel').textContent=`TWITCH · #${settings.channel || 'your_channel'}`; message('星見ミカ','最高のシーン！ 今日も配信ありがとう ✨',{badges:'subscriber/6',subscriber:'1',color:'#d6a3ff'});setTimeout(()=>alert('sub','NEW SUBSCRIBER','mikan_tea','','メンバーになりました！'),180); }
    if (!settings.channel || !window.tmi) return;
    const client = new window.tmi.Client({ connection:{secure:true,reconnect:true}, options:{skipMembership:true}, channels:[settings.channel] });
    client.on('message', (_channel,tags,text,self) => { if(!self)message(tags['display-name']||tags.username,text,tags); });
    client.on('cheer', (_channel,tags,text) => alert('cheer','CHEER',tags['display-name']||tags.username,`${tags.bits||''} Bits`,text));
    client.on('subscription', (_channel,user,_methods,note,tags) => alert('sub','NEW SUBSCRIBER',user,'',note));
    client.on('resub', (_channel,user,months,note) => alert('sub','RESUBSCRIBED',user,months?`${months} months`:'',note));
    client.on('subgift', (_channel,user,_months,recipient) => alert('gift','GIFT SUB',user,`for ${recipient}`));
    client.on('submysterygift', (_channel,user,count) => alert('gift','GIFT SUB',user,`${count} gifted`));
    client.connect().catch(error => console.warn('Twitch chat connection failed:', error));
  }

  function startEditor() {
    const form=document.querySelector('#widget-form'); const iframe=document.querySelector('#widget-preview'); const urlField=document.querySelector('#obs-url'); const toast=document.querySelector('#toast');
    const values = () => { const raw=new FormData(form); return {...defaults,...Object.fromEntries(raw),blur:form.elements.blur.checked?'1':'0'}; };
    const makeUrl = (preview=false) => { const q=new URLSearchParams(values());if(preview)q.set('preview','1');return `${new URL('view.html',location.href).href}?${q}`; };
    let refreshTimer; const update = () => { const s=values();applyTheme(s);urlField.value=makeUrl();clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>iframe.src=makeUrl(true),90);document.querySelector('#opacity-value').textContent=`${s.opacity}%`; };
    [...form.elements].forEach(el=>el.addEventListener('input',update)); [...form.elements].forEach(el=>el.addEventListener('change',update));
    document.querySelector('#copy-url').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(urlField.value);toast.textContent='OBS用URLをコピーしました';}catch{urlField.select();document.execCommand('copy');toast.textContent='OBS用URLをコピーしました';}toast.classList.add('is-visible');setTimeout(()=>toast.classList.remove('is-visible'),2200);});
    document.querySelector('.test-controls').addEventListener('click',event=>{const type=event.target.dataset.test;if(type){const targetOrigin=location.protocol==='file:'?'*':location.origin;iframe.contentWindow?.postMessage({source:'prism-editor',type},targetOrigin);}});
    update();
  }
  if(page==='editor')startEditor(); else if(page==='view')startView();
})();
