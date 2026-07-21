const chat = document.getElementById('chat');
const tplMsg = document.getElementById('tpl-message');
const tplAlert = document.getElementById('tpl-alert');
let LIMIT = 15;

function applySettings(f){
  if (!f) return;
  document.body.className = `theme-${f.theme || 'selene'} nf-${f.nameFont || 'mplus-rounded'} bf-${f.bodyFont || 'zen-kaku-gothic'} bg-${f.bgMode || 'gradient'}`;
  const root = document.documentElement.style;
  root.setProperty('--msg-weight', f.bodyWeight || '500');
  root.setProperty('--name-weight', f.nameWeight || '700');
  root.setProperty('--bg-opacity', ((Number(f.bgOpacity) || 72)/100).toString());
  LIMIT = Math.max(1, Number(f.messagesLimit) || 15);
}

function getRole(tags){
  const b = (tags && tags.badges) || '';
  if(b.includes('broadcaster')) return {cls:'sub', badge:'broadcaster', label:'配信者'};
  if(b.includes('moderator') || (tags&&tags.mod)==='1') return {cls:'mod', badge:'mod', label:'Mod'};
  if(b.includes('vip')) return {cls:'sub', badge:'vip', label:'VIP'};
  if(b.includes('artist')) return {cls:'sub', badge:'artist', label:'Artist'};
  if(b.includes('subscriber') || (tags&&tags.subscriber)==='1') return {cls:'sub', badge:'sub', label:'Sub'};
  return {cls:'reg', badge:'', label:''};
}

function nameColor(tags){
  if(tags && tags.color) return tags.color;
  let h=0, n=(tags&&tags['display-name'])||'u';
  for(const c of n) h=(h*31+c.charCodeAt(0))%360;
  return `hsl(${h} 70% 76%)`;
}

function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function trim(){
  while(chat.childElementCount > LIMIT){
    const old = chat.lastElementChild; if(!old) break;
    if(old.classList.contains('leaving')){ old.remove(); continue; }
    old.classList.add('leaving');
    const t=old; setTimeout(()=>{ if(t&&t.parentNode) t.remove(); },400);
    if(chat.childElementCount > LIMIT+3) old.remove(); else break;
  }
}

function renderMessage(data){
  const role = getRole(data.tags);
  const node = tplMsg.content.cloneNode(true);
  const msg = node.querySelector('.msg');
  if(role.cls==='sub') msg.classList.add('msg--sub');
  const badge = node.querySelector('.badge');
  if(role.badge){ badge.textContent = role.label; badge.classList.add('badge--'+role.badge); }
  const nameEl = node.querySelector('.msg__name');
  nameEl.textContent = data.displayName || data.tags?.['display-name'] || data.nick || '';
  nameEl.style.setProperty('--uc-1', nameColor(data.tags));
  const bubble = node.querySelector('.msg__bubble');
  bubble.innerHTML = data.renderedText || escapeHtml(data.text || '');
  chat.prepend(node);
  trim();
}

function renderAlert(type, kindLabel, name, amount, message, showBadge){
  const node = tplAlert.content.cloneNode(true);
  const alertEl = node.querySelector('.alert');
  alertEl.classList.add('alert--'+type);
  node.querySelector('.alert__kind').textContent = kindLabel;
  const line = node.querySelector('.alert__line');
  let html = `<span class="a-name">${escapeHtml(name||'')}</span> さん`;
  if(amount){
    html += ` — <span class="a-amt">${escapeHtml(amount)}</span>`;
    if(showBadge) html += `<span class="alert__amt-badge">${type==='cheer'?'Bits!':type==='gift'?'Gift!':'★'}</span>`;
  }
  line.innerHTML = html;
  node.querySelector('.alert__note').textContent = message || '';
  chat.prepend(node);
  trim();
}

window.addEventListener('onWidgetLoad', (obj) => applySettings(obj.detail.fieldData));
window.addEventListener('onEventReceived', (obj) => {
  const { listener, event } = obj.detail;
  const d = event.data || {};
  if(listener==='message') renderMessage(d);
  else if(listener==='subscriber-latest'){
    if(d.gifted || d.bulkGifted) renderAlert('gift','Gift Sub', d.sender||d.displayName, d.amount?`${d.amount}個`:'', d.message, true);
    else renderAlert('sub','New Subscriber', d.displayName, '', d.message, false);
  }
  else if(listener==='tip-latest') renderAlert('tip','Tip', d.name, `${d.amount}${d.currency||''}`, d.message, true);
  else if(listener==='cheer-latest') renderAlert('cheer','Cheer', d.name, `${d.amount} Bits`, d.message, true);
});

/* ---- プレビュー・テスト用コントロール ---- */
let cfg = {theme:'selene', nameFont:'mplus-rounded', bodyFont:'zen-kaku-gothic', bodyWeight:'500', nameWeight:'700', bgMode:'gradient', bgOpacity:72, messagesLimit:15};
applySettings(cfg);

const demoUsers = [
  {displayName:'みかん', tags:{badges:'subscriber/6', subscriber:'1', color:'#e57fb0'}, text:'ぐぐさんこんばんは〜！今日も応援してます✨'},
  {displayName:'kenta_09', tags:{badges:'', color:'#2b2bff'}, text:'この試合まじで熱い🔥'},
  {displayName:'ゆず', tags:{badges:'moderator/1', mod:'1', color:'#1fd6b0'}, text:'ナイスセーブ！！今の反応やばい'},
  {displayName:'Leo', tags:{badges:'vip/1', color:'#c86bff'}, text:"let's gooo what a run"},
  {displayName:'サクラ', tags:{badges:'artist/1', color:'#ff7f3f'}, text:'ロゴ描いたよ〜！使ってね🎨'},
  {displayName:'あおい', tags:{badges:'subscriber/12', subscriber:'1', color:'#7a5bff'}, text:'PKくるか…？ドキドキする'},
  {displayName:'たろう', tags:{badges:'', color:''}, text:'色未設定でもOK'},
];

let di=0, timer=null;
function playDemo(){
  if(timer){ clearInterval(timer); timer=null; }
  chat.innerHTML=''; di=0;
  const step=()=>{ renderMessage(demoUsers[di%demoUsers.length]); di++; };
  step();step();step();
  timer=setInterval(step,2800);
}

const btnDemo = document.getElementById('demo');
if(btnDemo) btnDemo.onclick = playDemo;

const btnSub = document.getElementById('aSub');
if(btnSub) btnSub.onclick = ()=>renderAlert('sub','New Subscriber','みかん','','いつも楽しい配信ありがとう〜',false);

const btnGift = document.getElementById('aGift');
if(btnGift) btnGift.onclick = ()=>renderAlert('gift','Gift Sub','ゆず','3個','みんなで楽しもう！',true);

const btnTip = document.getElementById('aTip');
if(btnTip) btnTip.onclick = ()=>renderAlert('tip','Tip','たろう','¥500','応援してます！勝ってね',true);

const btnCheer = document.getElementById('aCheer');
if(btnCheer) btnCheer.onclick = ()=>renderAlert('cheer','Cheer','Leo','500 Bits','ナイスプレー！！',true);

const selTheme = document.getElementById('selTheme');
if(selTheme) selTheme.onchange = e=>{ cfg.theme=e.target.value; applySettings(cfg); };

const selNameFont = document.getElementById('selNameFont');
if(selNameFont) selNameFont.onchange = e=>{ cfg.nameFont=e.target.value; applySettings(cfg); };

const selBodyFont = document.getElementById('selBodyFont');
if(selBodyFont) selBodyFont.onchange = e=>{ cfg.bodyFont=e.target.value; applySettings(cfg); };

document.querySelectorAll('.seg [data-bg]').forEach(btn=>btn.onclick=()=>{
  cfg.bgMode=btn.dataset.bg;
  document.querySelectorAll('.seg [data-bg]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); applySettings(cfg);
});

const inpOpacity = document.getElementById('opacity');
if(inpOpacity) inpOpacity.oninput = e=>{ cfg.bgOpacity=e.target.value; const valEl=document.getElementById('opVal'); if(valEl) valEl.textContent=e.target.value+'%'; applySettings(cfg); };

const stage = document.getElementById('stage');
document.querySelectorAll('.seg [data-stage]').forEach(btn=>btn.onclick=()=>{
  if(stage) stage.style.background=btn.dataset.stage;
  document.querySelectorAll('.seg [data-stage]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const stageColor = document.getElementById('stageColor');
  if(stageColor) stageColor.value = /^#[0-9a-f]{6}$/i.test(btn.dataset.stage)?btn.dataset.stage:'#101018';
});

const stageColor = document.getElementById('stageColor');
if(stageColor) stageColor.oninput = e=>{
  if(stage) stage.style.background=e.target.value;
  document.querySelectorAll('.seg [data-stage]').forEach(b=>b.classList.remove('on'));
};

const panelHide = document.getElementById('panelHide');
if(panelHide) panelHide.onclick = ()=>{ 
  const p = document.getElementById('panel'); if(p) p.classList.add('hidden'); 
  const pt = document.getElementById('panelToggle'); if(pt) pt.classList.add('show'); 
};

const panelToggle = document.getElementById('panelToggle');
if(panelToggle) panelToggle.onclick = ()=>{ 
  const p = document.getElementById('panel'); if(p) p.classList.remove('hidden'); 
  const pt = document.getElementById('panelToggle'); if(pt) pt.classList.remove('show'); 
};

// 自動でデモ再生スタート
playDemo();
