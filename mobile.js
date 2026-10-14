const form=document.querySelector('#portrait-form'),preview=document.querySelector('#portrait-preview'),stage=document.querySelector('#preview-stage');
const status=document.querySelector('#status'),applyStatus=document.querySelector('#apply-status'),applyButton=document.querySelector('#apply-portrait'),publishButton=document.querySelector('#publish'),urlField=document.querySelector('#portrait-url'),openOutput=document.querySelector('#open-output');
const draftKey='sparklechat-portrait-settings-v1',idKey='sparklechat-portrait-obs-id-v1';
const stored=(()=>{try{return JSON.parse(localStorage.getItem(draftKey)||'{}');}catch{return {};}})();
for(const [key,value] of Object.entries(stored)){const control=form.elements[key];if(!control)continue;if(control.type==='checkbox')control.checked=value===true;else control.value=String(value);}
let fixedId='';try{const value=localStorage.getItem(idKey)||'';if(/^[a-zA-Z0-9]{20}$/.test(value))fixedId=value;}catch{}
const outputUrl=id=>new URL(`all.html?id=${encodeURIComponent(id)}`,location.href).href;
if(fixedId){urlField.value=outputUrl(fixedId);openOutput.href=urlField.value;status.textContent='縦配信用の固定URLがあります。変更後は上の「変更を反映」を押してください。';}
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min));
function values(){const data={};for(const element of form.elements){if(!element.name)continue;data[element.name]=element.type==='checkbox'?element.checked:element.value;}return data;}
let savedSnapshot=JSON.stringify(values());
function config(){
 const v=values(),channel=String(v.channel||'').trim();
 const cfg={layout:'portrait',channel};
 if(v.inc_chat)cfg.chat={channel,theme:'selene',font:'zen',bg:'glass',opacity:'78',textSize:v.textSize,limit:'10',blur:'1',node:'dot',extras:'1',wrap:'18',badgeStyle:'image',align:'left',posX:v.posX,posY:v.posY,hlA:'90'};
 if(v.inc_frame){const ratios={'16:9':16/9,'1:1':1,'4:3':4/3,'9:16':9/16},ratio=ratios[v.cameraRatio]||16/9;
  const width=clamp(v.cameraWidth,120,Math.min(900,Math.floor(1920*ratio))),height=Math.round(width/ratio);
  cfg.frame={channel,fw:v.fw,fr:v.fr,fri:Math.max(0,+v.fr-14).toString(),fpw:'100',fph:'100',mode:'gradient',ccount:'2',c1:v.c1,c2:v.c2,glow:v.glow,flow:'40',shine:'50',sheenOn:'1',spark:'12',dividerOn:v.dividerOn?'1':'0',dividerY:String(Math.round(clamp(v.dividerPos,10,90)*1920/100)),dividerWidth:v.dividerWidth,cameraOn:v.cameraOn?'1':'0',cameraRatio:v.cameraRatio,cameraWidth:String(width),cameraX:String(clamp(v.cameraX,0,1080-width)),cameraY:String(clamp(v.cameraY,0,1920-height)),cameraStroke:'12'};
 }
 if(v.inc_alert)cfg.alert={channel,pos:v.alertPos,skin:'classic',font:'maru',anim:'poyon',dur:'5',size:v.alertSize,bg:'#0d0e1b',bgA:'70',vol:'70',sub:'1',resub:'1',gift:'1',follow:'1',bits:'1',points:'1',donate:'1',streak:'1',hype:'1'};
 if(v.inc_extras&&v.telop.trim())cfg.extras={tOn:'1',tFont:'maru',tBg:'#181226',tBgA:'72',tAnchor:'top',tSize:'30',tSpeed:'90',sOn:'0',chOn:'0',telops:JSON.stringify([{n:'LIVE',c:'#ff9ecf',t:v.telop.trim(),d:12}])};
 return cfg;
}
function fit(){preview.style.transform=`scale(${stage.clientWidth/1080})`;}
new ResizeObserver(fit).observe(stage);fit();
let previewTimer;
function update(){
 const v=values();for(const out of document.querySelectorAll('output[data-for]'))out.textContent=out.dataset.for==='dividerPos'?`上 ${v.dividerPos}% / 下 ${100-v.dividerPos}%`:v[out.dataset.for]+(out.dataset.for==='glow'?'%':'px');
 const ratio={'16:9':16/9,'1:1':1,'4:3':4/3,'9:16':9/16}[v.cameraRatio]||16/9;
 form.elements.cameraWidth.max=String(Math.min(900,Math.floor(1920*ratio)));
 if(+form.elements.cameraWidth.value>+form.elements.cameraWidth.max)form.elements.cameraWidth.value=form.elements.cameraWidth.max;
 const width=+form.elements.cameraWidth.value,height=Math.round(width/ratio);
 form.elements.cameraX.max=String(1080-width);form.elements.cameraY.max=String(1920-height);
 if(+form.elements.cameraX.value>+form.elements.cameraX.max)form.elements.cameraX.value=form.elements.cameraX.max;
 if(+form.elements.cameraY.value>+form.elements.cameraY.max)form.elements.cameraY.value=form.elements.cameraY.max;
 try{localStorage.setItem(draftKey,JSON.stringify(values()));}catch{}
 clearTimeout(previewTimer);previewTimer=setTimeout(()=>{const cfg=config();if(cfg.chat)cfg.chat.preview='1';preview.src='all.html?c='+encodeURIComponent(JSON.stringify(cfg));},250);
 if(fixedId&&JSON.stringify(values())!==savedSnapshot){status.textContent='変更はこの端末に保存しました。上の「変更を反映」でOBSへ保存してください。';applyStatus.textContent='未反映の変更があります';applyButton.textContent='変更を反映';}
}
form.addEventListener('input',update);form.addEventListener('change',update);update();
async function save(copy){
 applyButton.disabled=true;publishButton.disabled=true;applyButton.textContent='保存中…';applyStatus.textContent='保存中…';status.textContent='縦配信の設定を保存中…';
 const snapshot=JSON.stringify(values());
 try{const response=await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:fixedId||undefined,config:config()})});const data=await response.json();if(!response.ok)throw Error(data.error||'保存できませんでした');
  fixedId=data.id;localStorage.setItem(idKey,fixedId);urlField.value=outputUrl(fixedId);openOutput.href=urlField.value;
  savedSnapshot=snapshot;const changedDuringSave=JSON.stringify(values())!==snapshot;
  applyStatus.textContent=changedDuringSave?'未反映の変更があります':'保存済み・OBSへ反映中';applyButton.textContent=changedDuringSave?'変更を反映':'反映済み';
  if(copy){try{await navigator.clipboard.writeText(urlField.value);status.textContent='縦配信用URLを保存してコピーしました。OBSへ約1分で反映されます。';}
   catch{urlField.select();status.textContent='縦配信用URLを保存しました。入力欄からコピーしてください。';}}
  else status.textContent='変更を保存しました。同じOBS URLへ約1分で反映されます。';
 }catch(error){applyStatus.textContent='保存できませんでした';applyButton.textContent='再試行';status.textContent=error.message+'。設定はこの端末に残っています。';}
 finally{applyButton.disabled=false;publishButton.disabled=false;}
}
applyButton.addEventListener('click',()=>save(!fixedId));
publishButton.addEventListener('click',()=>save(true));
