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
    [...form.elements].forEach(x=>{x.addEventListener('input',update);x.addEventListener('change',update);});document.querySelector('#copy-url').onclick=async()=>{update();try{await navigator.clipboard.writeText(out.value);flash('URLに反映してコピーしました');}catch{out.select();document.execCommand('copy');flash('URLに反映してコピーしました');}};document.querySelector('.test-controls').onclick=e=>{const t=e.target.dataset.test;if(t)frame.contentWindow?.postMessage({source:'prism-editor',type:t},location.protocol==='file:'?'*':location.origin);};update();tabs();frameEditor();alertEditor();collapsibles();syncChannels();
  }

  /* ---------- editor: carry the channel name into the other tabs while they are empty ---------- */
  function syncChannels(){
    const chat=document.querySelector('#channel');if(!chat)return;
    chat.addEventListener('input',()=>{
      ['#frame-channel','#alert-channel'].forEach(sel=>{
        const el=document.querySelector(sel);
        if(el&&!el.value.trim()){el.value=chat.value;el.dispatchEvent(new Event('input',{bubbles:true}));}
      });
    });
  }

  /* ---------- editor: alert overlay ---------- */
  function alertEditor(){
    const form=document.querySelector('#alert-form');if(!form)return;
    const frame=document.querySelector('#alert-preview'),out=document.querySelector('#alert-url'),toast=document.querySelector('#toast');
    const EVENTS=['sub','resub','gift','follow','bits','points','donate'];
    const DEF={pos:'bc',font:'maru',anim:'poyon',dur:'5',tail:'0',
      size:'26',radius:'100',pad:'22',txt:'#ffffff',acc:'#ff8fc5',ico:'#ffffff',icoBg:'#ff8fc5',icoBgA:'100',
      snd:'',vol:'70',
      bg:'#181226',bgA:'62',blur:'14',glass:'140',
      brOn:'0',brC:'#ffffff',brW:'2',brA:'45',
      glOn:'0',glC:'#ff8fc5',glS:'40',glB:'40',
      sub:'1',resub:'1',gift:'1',follow:'1',bits:'1',points:'1',donate:'1',demo:'0',channel:''};
    const CHECKS=[...EVENTS,'tail','brOn','glOn','demo'];
    const OUTS={asize:['size','px'],aradius:['radius','px'],apad:['pad','px'],adur:['dur','秒'],
      abgA:['bgA','%'],ablur:['blur','px'],aglass:['glass','%'],aicoBgA:['icoBgA','%'],avol:['vol','%'],
      abrW:['brW','px'],abrA:['brA','%'],aglS:['glS',''],aglB:['glB','px']};
    const target=location.protocol==='file:'?'*':location.origin;
    const NAMES=['mikan_tea','はると','Kaito','ちゃんゆき','LunaTV','pixel_fan'];
    /* [detail, number, numberLabel] used by the test buttons */
    const SAMPLE={sub:['Tier 1',0,''],resub:['',12,'MONTHS'],gift:['×1',5,'GIFTS'],follow:['',0,''],
      bits:['500 BITS',0,''],points:['',0,''],donate:['¥1,000',0,'']};
    const values=()=>{const v={...DEF,...Object.fromEntries(new FormData(form))};CHECKS.forEach(k=>{const el=form.elements[k];if(el)v[k]=el.checked?'1':'0';});return v;};
    const url=()=>`${new URL('alert.html',location.href).href}?${new URLSearchParams(values())}`;
    const flash=m=>{toast.textContent=m;toast.classList.add('is-visible');setTimeout(()=>toast.classList.remove('is-visible'),1800);};
    let timer,loaded=false,lastCh=null;
    const update=()=>{
      const v=values();out.value=url();
      for(const id in OUTS){const[k,u]=OUTS[id],el=document.querySelector(`#${id}-value`);if(el)el.textContent=(k==='radius'&&+v[k]>=100)?'まる':v[k]+u;}
      if(!loaded||v.channel!==lastCh){lastCh=v.channel;loaded=true;clearTimeout(timer);timer=setTimeout(()=>{frame.src=url();},400);}
      else frame.contentWindow?.postMessage({source:'prism-editor',type:'alert-settings',settings:v},target);
    };
    [...form.elements].forEach(x=>{x.addEventListener('input',update);x.addEventListener('change',update);});

    const fit=()=>{const st=frame.parentElement;if(!st)return;const r=st.getBoundingClientRect();if(!r.width)return;
      const sc=Math.min(r.width/1920,r.height/1080);
      Object.assign(frame.style,{width:'1920px',height:'1080px',right:'auto',bottom:'auto',transformOrigin:'top left',transform:`scale(${sc})`,left:((r.width-1920*sc)/2)+'px',top:((r.height-1080*sc)/2)+'px'});};
    window.addEventListener('resize',fit);
    window.addEventListener('panelchange',e=>{if(e.detail==='alert')fit();});

    document.querySelector('[data-panel=alert].test-controls')?.addEventListener('click',e=>{
      const ev=e.target.dataset.alertEvent;if(!ev)return;
      const[detail,num,numLabel]=SAMPLE[ev]||['',0,''];
      frame.contentWindow?.postMessage({source:'prism-editor',type:'alert-event',event:ev,
        name:NAMES[Math.floor(Math.random()*NAMES.length)],detail,
        num:+(e.target.dataset.alertNum||num),numLabel},target);});

    /* local sound file -> embedded as a data URI so it also plays inside OBS */
    const sndInfo=document.querySelector('#snd-info');
    const setSndInfo=t=>{if(sndInfo)sndInfo.textContent='効果音: '+t;};
    document.querySelector('#snd-file')?.addEventListener('change',e=>{
      const f=e.target.files&&e.target.files[0];if(!f)return;
      if(f.size>260000){flash('音声が大きすぎます（260KB以下の短い効果音にしてください）');e.target.value='';return;}
      const rd=new FileReader();
      rd.onload=()=>{form.elements.snd.value=String(rd.result||'');setSndInfo(`${f.name}（${Math.round(f.size/1024)}KB）`);update();flash('効果音を設定しました');};
      rd.onerror=()=>flash('音声の読み込みに失敗しました');
      rd.readAsDataURL(f);
    });
    document.querySelector('#snd-test')?.addEventListener('click',()=>{
      if(!form.elements.snd.value){flash('先に効果音ファイルを選んでください');return;}
      frame.contentWindow?.postMessage({source:'prism-editor',type:'alert-sound'},target);});
    document.querySelector('#snd-clear')?.addEventListener('click',()=>{
      form.elements.snd.value='';const fi=document.querySelector('#snd-file');if(fi)fi.value='';
      setSndInfo('未設定');update();flash('効果音を解除しました');});
    document.querySelector('#alert-copy').onclick=async()=>{update();
      try{await navigator.clipboard.writeText(out.value);flash('アラートのURLをコピーしました');}
      catch{out.select();document.execCommand('copy');flash('アラートのURLをコピーしました');}};

    update();fit();
  }

  /* ---------- editor: collapsible sections ---------- */
  function collapsibles(){
    document.querySelectorAll('.settings-form legend').forEach(lg=>{
      lg.addEventListener('click',()=>lg.parentElement.classList.toggle('is-collapsed'));
    });
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
    const DEF={fw:'14',fr:'28',fri:'14',mode:'gradient',ccount:'4',
      c1:'#ffd6ec',c2:'#cde7ff',c3:'#e6d9ff',c4:'#d9fff0',c5:'#fff3c4',c6:'#ffd9d9',c7:'#d9f2ff',c8:'#f0d9ff',
      glow:'55',flow:'40',shine:'50',sheenOn:'1',spark:'14',
      sub:'1',gift:'1',follow:'1',bits:'1',points:'1',donate:'1',
      subA:'burst',giftA:'burst',followA:'pulse',bitsA:'shine',pointsA:'rainbow',donateA:'burst',
      subP:'1',giftP:'1',followP:'0',bitsP:'1',pointsP:'0',donateP:'1',channel:''};
    const EVENTS=['sub','gift','follow','bits','points','donate'];
    const EV_LABEL={sub:'サブスク',gift:'サブギフト',follow:'フォロー',bits:'Bits',points:'ポイント',donate:'ドネ'};
    /* per-event particle defaults: shape, motion, count, size, speed, opacity */
    const P_DEF={sub:['heart','pile','5','38','50','90'],gift:['heart','fall','14','30','55','85'],
      follow:['shine','float','10','24','40','80'],bits:['coin','rise','14','26','60','85'],
      points:['shine','rise','12','26','50','80'],donate:['mix','fall','16','32','50','85']};
    const SHAPE_OPTS=[['heart','♥︎'],['coin','●'],['shine','✦'],['mix','ミックス']];
    const MOTION_OPTS=[['rise','下から'],['fall','上から'],['float','ふわふわ'],['pile','積もる']];
    EVENTS.forEach(e=>{const[sh,mo,ct,sz,sp,op]=P_DEF[e];
      Object.assign(DEF,{[e+'pShape']:sh,[e+'pMotion']:mo,[e+'pCount']:ct,[e+'pSize']:sz,[e+'pSpeed']:sp,[e+'pOpa']:op,
        [e+'pCMode']:'mix',[e+'pC1']:'#ffd6ec',[e+'pC2']:'#cde7ff',[e+'pC3']:'#e6d9ff',[e+'pC4']:'#fff3c4'});});
    const CHECKS=[...EVENTS,...EVENTS.map(e=>e+'P'),'sheenOn'];
    const UNITS={fw:'px',fr:'px',fri:'px',glow:'%'};
    const OUTS=['fw','fr','fri','glow','flow','shine','spark'];
    const P_OUTS=['pCount','pSize','pSpeed','pOpa'],P_UNITS={pSize:'px',pOpa:'%'};
    const target=location.protocol==='file:'?'*':location.origin;
    const values=()=>{const v={...DEF,...Object.fromEntries(new FormData(form))};CHECKS.forEach(k=>{const el=form.elements[k];if(el)v[k]=el.checked?'1':'0';});return v;};
    const url=()=>`${new URL('frame.html',location.href).href}?${new URLSearchParams(values())}`;
    const flash=m=>{toast.textContent=m;toast.classList.add('is-visible');setTimeout(()=>toast.classList.remove('is-visible'),1800);};
    let timer,loaded=false,lastCh=null;
    const update=()=>{
      const v=values();out.value=url();
      OUTS.forEach(k=>{const el=document.querySelector(`#${k}-value`);if(el)el.textContent=v[k]+(UNITS[k]||'');});
      EVENTS.forEach(e=>P_OUTS.forEach(k=>{const el=document.querySelector(`#${e}${k}-value`);if(el)el.textContent=v[e+k]+(P_UNITS[k]||'');}));
      if(!loaded||v.channel!==lastCh){lastCh=v.channel;loaded=true;clearTimeout(timer);timer=setTimeout(()=>{frame.src=url();},400);}
      else frame.contentWindow?.postMessage({source:'prism-editor',type:'frame-settings',settings:v},target);
    };
    /* per-event particle panels (one block per event, switched by the tabs above) */
    (()=>{
      const tabs=document.querySelector('#pev-tabs'),host=document.querySelector('#particle-panels');
      if(!tabs||!host)return;
      tabs.textContent='';host.textContent='';
      EVENTS.forEach((e,i)=>{
        const b=document.createElement('button');b.type='button';b.className='pev'+(i?'':' is-active');b.dataset.pev=e;b.textContent=EV_LABEL[e];tabs.appendChild(b);
        const[sh,mo,ct,sz,sp,op]=P_DEF[e];
        const panel=document.createElement('div');panel.className='pblock';panel.dataset.pev=e;if(i)panel.hidden=true;
        const range=(key,label,min,max,val,unit)=>`<div class="range-row"><label class="field-label" for="${e}${key}">${label} <output id="${e}${key}-value">${val}${unit}</output></label><input id="${e}${key}" name="${e}${key}" type="range" min="${min}" max="${max}" value="${val}"></div>`;
        panel.innerHTML=
          `<div class="field"><span class="field-label">形</span><div class="segmented">`
          +SHAPE_OPTS.map(([v,l])=>`<label><input type="radio" name="${e}pShape" value="${v}"${v===sh?' checked':''}><span>${l}</span></label>`).join('')
          +`</div></div><div class="field"><span class="field-label">動き</span><div class="segmented">`
          +MOTION_OPTS.map(([v,l])=>`<label><input type="radio" name="${e}pMotion" value="${v}"${v===mo?' checked':''}><span>${l}</span></label>`).join('')
          +`</div></div>`
          +range('pCount','量',0,60,ct,'')+range('pSize','大きさ',8,90,sz,'px')
          +range('pSpeed','速さ',0,100,sp,'')+range('pOpa','濃さ',10,100,op,'%')
          +`<div class="field"><span class="field-label">カラー</span>`
          +`<select name="${e}pCMode"><option value="mix">枠カラーをミックス</option><option value="custom">選んだ4色から</option></select>`
          +`<div class="color-row">`
          +[['pC1','#ffd6ec'],['pC2','#cde7ff'],['pC3','#e6d9ff'],['pC4','#fff3c4']]
            .map(([k,v],i)=>`<input type="color" name="${e}${k}" value="${v}" aria-label="パーティクル色${i+1}">`).join('')
          +`</div></div>`;
        host.appendChild(panel);
      });
      tabs.addEventListener('click',ev=>{const b=ev.target.closest('[data-pev]');if(!b)return;
        tabs.querySelectorAll('.pev').forEach(x=>x.classList.toggle('is-active',x===b));
        host.querySelectorAll('.pblock').forEach(p=>{p.hidden=p.dataset.pev!==b.dataset.pev;});});
    })();

    [...form.elements].forEach(x=>{x.addEventListener('input',update);x.addEventListener('change',update);});
    document.querySelector('#frame-clear')?.addEventListener('click',()=>frame.contentWindow?.postMessage({source:'prism-editor',type:'frame-clear'},target));

    /* colour count: show only the swatches in use (2-8) */
    const syncColors=()=>{const n=Math.max(2,Math.min(8,Math.round(+form.elements.ccount.value)||4));
      form.elements.ccount.value=String(n);
      form.querySelectorAll('#color-row input[type=color]').forEach((el,i)=>{el.hidden=i>=n;});
      const cv=document.querySelector('#ccount-value');if(cv)cv.textContent=n+'色';};
    const bumpColors=d=>{form.elements.ccount.value=String((+form.elements.ccount.value||4)+d);syncColors();update();};
    document.querySelector('#color-add').onclick=()=>bumpColors(1);
    document.querySelector('#color-del').onclick=()=>bumpColors(-1);

    /* saved colour palettes (localStorage) */
    const PKEY='sparklechat-palettes';
    const palRead=()=>{try{return JSON.parse(localStorage.getItem(PKEY))||{};}catch{return{};}};
    const palWrite=p=>{try{localStorage.setItem(PKEY,JSON.stringify(p));}catch{}};
    const palList=document.querySelector('#pal-list');
    const palRefresh=()=>{const p=palRead();palList.textContent='';
      const o=document.createElement('option');o.value='';o.textContent='保存済みカラー…';palList.appendChild(o);
      Object.keys(p).forEach(n=>{const x=document.createElement('option');x.value=n;x.textContent=n;palList.appendChild(x);});};
    document.querySelector('#pal-save').onclick=()=>{const el=document.querySelector('#pal-name'),n=el.value.trim();if(!n)return;
      const v=values(),pal={ccount:v.ccount};for(let i=1;i<=8;i++)pal['c'+i]=v['c'+i];
      const p=palRead();p[n]=pal;palWrite(p);palRefresh();palList.value=n;el.value='';flash(`カラー「${n}」を保存しました`);};
    document.querySelector('#pal-load').onclick=()=>{const v=palRead()[palList.value];if(!v)return;
      for(const k in v){const el=form.elements[k];if(el)el.value=v[k];}
      syncColors();update();flash('カラーを読み込みました');};
    document.querySelector('#pal-del').onclick=()=>{const p=palRead();if(!palList.value||!p[palList.value])return;
      delete p[palList.value];palWrite(p);palRefresh();flash('カラーを削除しました');};
    palRefresh();

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
      syncColors();update();flash('プリセットを読み込みました');};
    document.querySelector('#preset-del').onclick=()=>{const p=read();if(!list.value||!p[list.value])return;delete p[list.value];write(p);refresh();flash('プリセットを削除しました');};
    refresh();syncColors();update();fit();
  }

  if(page==='view')view();if(page==='editor')editor();
})();
