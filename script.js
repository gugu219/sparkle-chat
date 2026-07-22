(() => {
  'use strict';
  const page=document.documentElement.dataset.page;
  const defaults={channel:'',theme:'selene',font:'zen',bg:'glass',opacity:'78',textSize:'15',limit:'12',blur:'1',node:'dot',extras:'1',wrap:'40',badgeStyle:'image',align:'left'};
  const qs=new URLSearchParams(location.search);
  const settings=()=>Object.fromEntries(Object.keys(defaults).map(k=>[k,qs.get(k)??defaults[k]]));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const color=n=>{let h=0;for(const c of String(n||'viewer'))h=(h*31+c.charCodeAt(0))%360;return `hsl(${h} 82% 77%)`;};
  const emoteUrl=id=>`https://static-cdn.jtvnw.net/emoticons/v2/${String(id).replace(/[^\w]/g,'')}/default/dark/2.0`;
  const renderEmotes=(text,emotes)=>{if(!emotes||!Object.keys(emotes).length)return null;const chars=[...String(text)],repl=[];for(const id in emotes)for(const rng of emotes[id]){const p=String(rng).split('-'),a=+p[0],b=+p[1];if(Number.isInteger(a)&&Number.isInteger(b)&&b>=a)repl.push([a,b,id]);}repl.sort((x,y)=>x[0]-y[0]);let html='',cur=0;for(const[a,b,id]of repl){if(a<cur)continue;if(a>cur)html+=esc(chars.slice(cur,a).join(''));const alt=esc(chars.slice(a,b+1).join(''));html+=`<img class="emote" src="${emoteUrl(id)}" alt="${alt}" title="${alt}" loading="lazy">`;cur=b+1;}if(cur<chars.length)html+=esc(chars.slice(cur).join(''));return html;};
  let badgeMap=null;
  const BADGE_CORE=new Set(['broadcaster','moderator','vip','subscriber','founder','staff','admin','global_mod','partner']);
  const loadBadges=async channel=>{if(location.protocol==='file:')return null;try{const r=await fetch(`/api/badges?channel=${encodeURIComponent(channel||'')}`);if(!r.ok)return null;const m=await r.json();return m&&!m.error?m:null;}catch{return null;}};
  const badgeImgs=(badges,extras,skipCore)=>{if(!badgeMap||!badges||typeof badges!=='object')return null;let html='';for(const set in badges){const core=BADGE_CORE.has(set);if(skipCore&&core)continue;if(!extras&&!core)continue;const url=badgeMap[`${set}/${badges[set]}`];if(url)html+=`<img class="badge-img" src="${esc(url)}" alt="${esc(set)}" title="${esc(set)}" loading="lazy">`;}return html||null;};
  const hasBadge=(t,k)=>{const b=t.badges;if(b&&typeof b==='object')return k in b;if(typeof b==='string')return b.includes(k);return false;};
  const apply=s=>{const b=document.body;const base=page==='view'?`widget font-${s.font} node-${s.node||'dot'} align-${s.align||'left'}`:'app-shell';b.className=`${base} theme-${s.theme} bg-${s.bg}${s.blur==='1'?' use-blur':''}`;document.documentElement.style.setProperty('--bubble-opacity',Math.max(.25,Math.min(1,+s.opacity/100)));document.documentElement.style.setProperty('--text-size',`${Math.max(8,Math.min(80,+s.textSize||15))}px`);document.documentElement.style.setProperty('--wrap',Math.max(6,Math.min(90,+s.wrap||40)));};
  const session=async id=>{if(!id||location.protocol==='file:')return null;try{const r=await fetch(`/api/auth/session?widget=${encodeURIComponent(id)}`);return r.ok?r.json():null;}catch{return null;}};

  async function view(){
    let s=settings();apply(s);const chat=document.querySelector('#chat'),mt=document.querySelector('#message-template'),at=document.querySelector('#alert-template');
    const trim=()=>{const limit=Math.max(1,+s.limit||12);const live=[];for(const x of chat.children)if(!x.classList.contains('is-leaving'))live.push(x);for(let i=limit;i<live.length;i++){const x=live[i];x.classList.add('is-leaving');setTimeout(()=>{x.remove();},320);}};
    const role=t=>{if(hasBadge(t,'broadcaster'))return['broadcaster','LIVE'];if(hasBadge(t,'moderator')||t.mod===true||t.mod==='1')return['mod','MOD'];if(hasBadge(t,'vip'))return['vip','VIP'];if(hasBadge(t,'subscriber')||t.subscriber===true||t.subscriber==='1')return['sub','SUB'];return['',''];};
    const msg=(name,text,tags={})=>{const f=mt.content.cloneNode(true),user=f.querySelector('.chat-message__name');if(tags['msg-id']==='highlighted-message'||tags['custom-reward-id'])f.querySelector('.chat-message').classList.add('is-highlight');const pill=s.badgeStyle==='pill',showExtras=s.extras==='1';const imgs=badgeMap?badgeImgs(tags.badges,showExtras,pill):null,bl=f.querySelector('.badge-list');if(imgs&&bl)bl.innerHTML=imgs;if(pill||!badgeMap){const[kind,label]=role(tags),badge=f.querySelector('.role-badge');if(kind){badge.classList.add(`badge-${kind}`);badge.textContent=label;}}user.textContent=name||'Viewer';user.style.setProperty('--user-color',tags.color||color(name));const bubble=f.querySelector('.chat-message__bubble');let em=null;try{em=renderEmotes(text||'',tags.emotes);}catch{}if(em!=null)bubble.innerHTML=em;else bubble.textContent=text||'';chat.prepend(f);trim();};
    const alert=(type,label,name,amount='',note='')=>{const f=at.content.cloneNode(true);f.querySelector('.chat-alert__border').classList.add(`alert-${type}`);f.querySelector('.chat-alert__kind').textContent=label;f.querySelector('.chat-alert__line').innerHTML=`<span class="a-name">${esc(name||'Anonymous')}</span>${amount?` <span class="a-amount">${esc(amount)}</span>`:''}`;const n=f.querySelector('.chat-alert__note');n.textContent=note||'';if(!n.textContent)n.remove();chat.prepend(f);trim();};
    const rnd=a=>a[Math.floor(Math.random()*a.length)];
    const demoNames=['はると','Mika','tanaka_ch','ゲーマー太郎','xX_Sniper_Xx','ちゃんゆき','kuroneko','ProPlayer99','さくら','viewer_jp','ReiRei','GG_master','ののか','shadow_x','うさぎcat','LunaTV','けんと','pixel_fan','yamada__','streamlover'];
    const demoJP=['かわいいｗ','うますぎる','ナイスプレイ！','がんばれー！','ここすき','それは草','www','おつかれさま','神回すぎる','いいね','おおおおお','ドンマイ！','惜しい！','応援してます','初見です！','かっこいい','やったー！','うぽつ','最高','今のすごい'];
    const demoEN=['GG','nice one!','LETS GOOO','so clean','pog','LMAO','clutch!','ez','insane play','o7','first time here','love this stream','KEKW','sheesh','no way lol','well played','hyped','W streamer','that was sick','+1'];
    const demoColors=['#ff8fc5','#70e4ff','#a997ff','#ffd49b','#8affc1','#ffa6a6','#c9b0ff','#7ceaf7','#ff9d5c'];
    let demoTimer=null;
    const demoTick=()=>{
      const roll=Math.random();
      if(roll<0.06)alert('cheer','CHEER',rnd(demoNames),`${rnd([100,300,500,1000,5000])} Bits`,rnd(['Nice play!','がんばれ！','pog','ナイス！']));
      else if(roll<0.11)alert('gift','GIFT SUB',rnd(demoNames),`×${rnd([1,3,5,10])} GIFTED`,rnd(['Enjoy!','よろしく！','']));
      else if(roll<0.16)alert('sub','NEW SUBSCRIBER',rnd(demoNames),'',rnd(['Welcome!','よろしくお願いします！','']));
      else{const name=rnd(demoNames);let text=Math.random()<0.5?rnd(demoEN):rnd(demoJP);const tags={color:rnd(demoColors),badges:{}};const b=Math.random();if(b<0.32)tags.badges.subscriber=String(rnd([1,3,6,12]));else if(b<0.40)tags.badges.moderator='1';else if(b<0.47)tags.badges.vip='1';if(Math.random()<0.12)tags.badges.bits=String(rnd([100,1000]));if(Math.random()<0.18){const base=text;text=base+' Kappa';const st=[...base].length+1;tags.emotes={'25':[`${st}-${st+4}`]};}msg(name,text,tags);}
      demoTimer=setTimeout(demoTick,650+Math.random()*1050);
    };
    const toggleDemo=()=>{if(demoTimer){clearTimeout(demoTimer);demoTimer=null;}else demoTick();};
    window.addEventListener('message',e=>{
      if(e.data?.source!=='prism-editor')return;const type=e.data.type;
      if(type==='settings'){Object.assign(s,e.data.settings||{});apply(s);if(qs.has('preview'))document.body.classList.add('is-preview');trim();return;}
      if(type==='demo'){toggleDemo();return;}
      ({message:()=>msg('Mika','Great stream! Kappa',{subscriber:'1',badges:{subscriber:'0'},emotes:{'25':['14-18']}}),sub:()=>alert('sub','NEW SUBSCRIBER','mikan_tea','','Welcome!'),gift:()=>alert('gift','GIFT SUB','Kaito','×5 GIFTED','Enjoy the ride!'),cheer:()=>alert('cheer','CHEER','Kenta','500 Bits','Nice play!'),highlight:()=>msg('Rei','これは強調表示メッセージです ✨',{subscriber:'1',badges:{subscriber:'0'},'msg-id':'highlighted-message'})}[type]||(()=>{}))();
    });
    badgeMap=await loadBadges(String(s.channel||'').trim().toLowerCase());
    if(qs.has('preview')){document.body.classList.add('is-preview');document.querySelector('#preview-channel').textContent=`TWITCH #${s.channel||'your_channel'}`;msg('Mika','Great stream! Kappa',{subscriber:'1',badges:{subscriber:'0'},emotes:{'25':['14-18']}});}
    const dbg=qs.has('debug');const status=(t,cls='')=>{console.log('[prism]',t);if(!dbg)return;let el=document.querySelector('#diag');if(!el){el=document.createElement('div');el.id='diag';document.body.appendChild(el);}el.className=cls;el.textContent=t;};
    const auth=await session(qs.get('widget'));const channel=String(s.channel||'').trim().toLowerCase();
    if(!channel){status('チャンネル名が未設定です','diag-err');return;}
    if(!window.tmi){status('tmi.js の読み込みに失敗しました','diag-err');return;}
    const opts={connection:{secure:true,reconnect:true},options:{skipMembership:true},channels:[channel]};if(auth)opts.identity={username:auth.login,password:`oauth:${auth.accessToken}`};
    status(`接続中… #${channel}${auth?` (認証: ${auth.login})`:' (匿名)'}`);
    const c=new window.tmi.Client(opts);
    c.on('connected',()=>status(`接続済み #${channel}${auth?` · ${auth.login}`:' · 匿名'}`,'diag-ok'));c.on('disconnected',r=>status(`切断: ${r||'不明'}`,'diag-err'));c.on('notice',(_,id,m)=>{if(id==='msg_channel_suspended'||id==='no_permission')status(`Twitch: ${m}`,'diag-err');});
    c.on('message',(_,t,text,self)=>{if(!self)msg(t['display-name']||t.username,text,t);});c.on('cheer',(_,t,text)=>alert('cheer','CHEER',t['display-name']||t.username,`${t.bits||''} Bits`,text));c.on('subscription',(_,u,_m,n)=>alert('sub','NEW SUBSCRIBER',u,'',n));c.on('resub',(_,u,m,n)=>alert('sub','RESUBSCRIBED',u,m?`${m} months`:'',n));c.on('subgift',(_,u,_m,r)=>alert('gift','GIFT SUB',u,`for ${r}`));
    c.connect().catch(e=>status(`接続エラー: ${e}`,'diag-err'));
  }
  async function editor(){
    const form=document.querySelector('#widget-form'),frame=document.querySelector('#widget-preview'),out=document.querySelector('#obs-url'),toast=document.querySelector('#toast');
    const values=()=>({...defaults,...Object.fromEntries(new FormData(form)),blur:form.elements.blur.checked?'1':'0',extras:form.elements.extras.checked?'1':'0'});const url=(preview=false)=>{const p=new URLSearchParams(values());if(preview)p.set('preview','1');return `${new URL('view.html',location.href).href}?${p}`;};let timer,frameLoaded=false,lastChannel=null;const sendLive=s=>frame.contentWindow?.postMessage({source:'prism-editor',type:'settings',settings:s},location.protocol==='file:'?'*':location.origin);const update=()=>{const s=values();apply(s);out.value=url();document.querySelector('#opacity-value').textContent=`${s.opacity}%`;document.querySelector('#wrap-value').textContent=s.wrap;if(!frameLoaded||s.channel!==lastChannel){lastChannel=s.channel;frameLoaded=true;clearTimeout(timer);timer=setTimeout(()=>{frame.src=url(true);},400);}else sendLive(s);};
    const flash=m=>{toast.textContent=m;toast.classList.add('is-visible');setTimeout(()=>toast.classList.remove('is-visible'),1800);};
    [...form.elements].forEach(x=>{x.addEventListener('input',update);x.addEventListener('change',update);});document.querySelector('#copy-url').onclick=async()=>{update();try{await navigator.clipboard.writeText(out.value);flash('URLに反映してコピーしました');}catch{out.select();document.execCommand('copy');flash('URLに反映してコピーしました');}};document.querySelector('.test-controls').onclick=e=>{const t=e.target.dataset.test;if(t)frame.contentWindow?.postMessage({source:'prism-editor',type:t},location.protocol==='file:'?'*':location.origin);};update();tabs();frameEditor();
  }

  /* ---------- editor: overlay type tabs (chat / frame) ---------- */
  function tabs(){
    const bar=document.querySelector('.tab-bar');if(!bar)return;
    bar.addEventListener('click',e=>{
      const btn=e.target.closest('[data-tab]');if(!btn)return;
      const name=btn.dataset.tab;
      bar.querySelectorAll('[data-tab]').forEach(b=>{const on=b===btn;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));});
      document.querySelectorAll('[data-panel]').forEach(el=>{el.hidden=el.dataset.panel!==name;});
      window.dispatchEvent(new CustomEvent('panelchange',{detail:name}));
    });
  }

  /* ---------- editor: frame overlay settings ---------- */
  function frameEditor(){
    const form=document.querySelector('#frame-form');if(!form)return;
    const frame=document.querySelector('#frame-preview'),out=document.querySelector('#frame-url'),toast=document.querySelector('#toast');
    const DEF={fw:'14',fr:'28',c1:'#ffd6ec',c2:'#cde7ff',c3:'#e6d9ff',c4:'#d9fff0',glow:'55',flow:'40',shine:'50',spark:'14',sub:'1',follow:'1',bits:'1',points:'1',donate:'1',subA:'burst',followA:'pulse',bitsA:'shine',pointsA:'rainbow',donateA:'burst',channel:''};
    const EVENTS=['sub','follow','bits','points','donate'],UNITS={fw:'px',fr:'px',glow:'%'};
    const target=location.protocol==='file:'?'*':location.origin;
    const values=()=>{const v={...DEF,...Object.fromEntries(new FormData(form))};EVENTS.forEach(k=>{v[k]=form.elements[k].checked?'1':'0';});return v;};
    const url=()=>`${new URL('frame.html',location.href).href}?${new URLSearchParams(values())}`;
    const flash=m=>{toast.textContent=m;toast.classList.add('is-visible');setTimeout(()=>toast.classList.remove('is-visible'),1800);};
    let timer,loaded=false,lastCh=null;
    const update=()=>{
      const v=values();out.value=url();
      ['fw','fr','glow','flow','shine','spark'].forEach(k=>{const el=document.querySelector(`#${k}-value`);if(el)el.textContent=v[k]+(UNITS[k]||'');});
      if(!loaded||v.channel!==lastCh){lastCh=v.channel;loaded=true;clearTimeout(timer);timer=setTimeout(()=>{frame.src=url();},400);}
      else frame.contentWindow?.postMessage({source:'prism-editor',type:'frame-settings',settings:v},target);
    };
    [...form.elements].forEach(x=>{x.addEventListener('input',update);x.addEventListener('change',update);});

    /* render the preview at true 1920x1080 and scale it down, so it matches OBS exactly */
    const fit=()=>{const st=frame.parentElement;if(!st)return;const r=st.getBoundingClientRect();if(!r.width)return;
      const sc=Math.min(r.width/1920,r.height/1080);
      Object.assign(frame.style,{width:'1920px',height:'1080px',right:'auto',bottom:'auto',transformOrigin:'top left',transform:`scale(${sc})`,left:((r.width-1920*sc)/2)+'px',top:((r.height-1080*sc)/2)+'px'});};
    window.addEventListener('resize',fit);
    window.addEventListener('panelchange',e=>{if(e.detail==='frame')fit();});

    document.querySelector('[data-panel=frame].test-controls')?.addEventListener('click',e=>{
      const ev=e.target.dataset.frameEvent;if(ev)frame.contentWindow?.postMessage({source:'prism-editor',type:'frame-event',event:ev},target);});
    document.querySelector('#frame-copy').onclick=async()=>{update();
      try{await navigator.clipboard.writeText(out.value);flash('枠のURLをコピーしました');}
      catch{out.select();document.execCommand('copy');flash('枠のURLをコピーしました');}};

    /* presets (localStorage) */
    const KEY='sparklechat-frame-presets';
    const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return{};}};
    const write=p=>{try{localStorage.setItem(KEY,JSON.stringify(p));}catch{}};
    const list=document.querySelector('#preset-list');
    const refresh=()=>{const p=read();list.textContent='';const o=document.createElement('option');o.value='';o.textContent='保存済みプリセット…';list.appendChild(o);
      Object.keys(p).forEach(n=>{const x=document.createElement('option');x.value=n;x.textContent=n;list.appendChild(x);});};
    document.querySelector('#preset-save').onclick=()=>{const el=document.querySelector('#preset-name'),n=el.value.trim();if(!n)return;const p=read();p[n]=values();write(p);refresh();list.value=n;el.value='';flash(`プリセット「${n}」を保存しました`);};
    document.querySelector('#preset-load').onclick=()=>{const v=read()[list.value];if(!v)return;
      for(const k in v){const el=form.elements[k];if(!el)continue;if(el.type==='checkbox')el.checked=v[k]==='1';else el.value=v[k];}
      update();flash('プリセットを読み込みました');};
    document.querySelector('#preset-del').onclick=()=>{const p=read();if(!list.value||!p[list.value])return;delete p[list.value];write(p);refresh();flash('プリセットを削除しました');};
    refresh();update();fit();
  }

  if(page==='view')view();if(page==='editor')editor();
})();
