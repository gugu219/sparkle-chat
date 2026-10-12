// Tiny hand-drawn sprites stay sharp in both the editor and the OBS browser source.
const sprites={
 stream:['............','..dddddddd..','.dssssssssd.','.dssppssssd.','.dsspppsssd.','.dssppssssd.','.dssssssssd.','..dddddddd..','....d..d....'],
 rest:['............','dd......dd..','.dd....dd...','..dd..dd....','...dddd.....','....dd......','...dddd.....','..dd..dd....','.dd....dd...','dd......dd..'],
 game:['............','..dddddddd..','.dggggggggd.','dggdg..gdggd','dggddd.gdggd','dggdg..gdggd','dggggggggggd','.dggggggggd.','..dd....dd..'],
 chat:['............','..dddddddd..','.dccccccccd.','dccccccccccd','dccccccccccd','dccccccccccd','.dccccccccd.','..dddccddd..','...dccc.....','....dd......'],
 sing:['............','....dddd....','...dmmmmmd..','...dmmmmmd..','...dmmmmmd..','....dddd....','..d......d..','...dddddd...','.....dd.....','...dddddd...']
};
const spriteColors={stream:{d:'#72546b',s:'#fff4df',p:'#dc7294'},rest:{d:'#877c87'},game:{d:'#5a647a',g:'#a8c9a6'},chat:{d:'#826879',c:'#f5cbb1'},sing:{d:'#6b5472',m:'#d68bb7'}};
function pixelIcon(kind){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 12 10');svg.setAttribute('aria-hidden','true');svg.classList.add('pixel-icon');
 const colors=spriteColors[kind]||{};
 (sprites[kind]||[]).forEach((row,y)=>[...row].forEach((pixel,x)=>{if(!colors[pixel])return;const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',x);rect.setAttribute('y',y);rect.setAttribute('width',1);rect.setAttribute('height',1);rect.setAttribute('fill',colors[pixel]);svg.append(rect);}));
 return svg;
}
document.querySelectorAll('.sticker-guide span[data-kind]').forEach(label=>label.prepend(pixelIcon(label.dataset.kind)));
document.querySelectorAll('.stickers button').forEach(button=>{button.prepend(pixelIcon(button.dataset.kind));});
const startHourSelect=document.getElementById('start-hour');
if(startHourSelect)for(let hour=10;hour<=23;hour++){const option=document.createElement('option');option.value=String(hour);option.textContent=`${hour}時から`;startHourSelect.append(option);}
const localKey='sparkle-calendar-draft',idKey='sparkle-calendar-id',dirtyKey='sparkle-calendar-unsynced';
const overlay=document.body.classList.contains('calendar-overlay');
const params=new URLSearchParams(location.search);
const now=new Date();let year=Number(params.get('year'))||now.getFullYear(),month=Number(params.get('month'))||now.getMonth()+1;
if(month<1||month>12){year=now.getFullYear();month=now.getMonth()+1;}
let entries={},historyEntries={},selected='',calendarId='',revision=0,loading=true,saving=false,canSync=true,pendingLocalEdits=false;
const snapshot=params.get('snapshot');
function snapshotData(){
 const prefix=`${year}-${String(month).padStart(2,'0')}-`,days=new Date(year,month,0).getDate(),result={};
 for(let day=1;day<=days;day++){const key=prefix+String(day).padStart(2,'0'),entry=currentEntry(key);if(entry.kind||entry.text||entry.startHour)result[key]={kind:entry.kind||'',text:entry.text||'',startHour:entry.startHour||'',overrideHistory:true};}
 return result;
}
function encodeSnapshot(value){const bytes=new TextEncoder().encode(JSON.stringify(value));if(bytes.length>12000)throw Error('この月の内容は予備URLに収まりません。予定の文字を短くしてください。');return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function decodeSnapshot(value){if(!/^[A-Za-z0-9_-]{1,16000}$/.test(value))throw Error('予備URLの形式が正しくありません。');const encoded=value.replaceAll('-','+').replaceAll('_','/');const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length>31)throw Error('予備URLの予定を読み込めません。');return data;}
try{if(!overlay){entries=JSON.parse(localStorage.getItem(localKey)||'{}');calendarId=localStorage.getItem(idKey)||'';pendingLocalEdits=localStorage.getItem(dirtyKey)==='1';}}catch{}
const grid=document.getElementById('calendar-grid'),title=document.getElementById('month-title');
const currentEntry=key=>{const manual=entries[key],history=historyEntries[key];const entry=history&&!manual?.overrideHistory?history:manual||history||{};return entry.kind==='drink'?{...entry,kind:'chat'}:entry;};
const editedEntry=(key,change)=>({...currentEntry(key),...change,overrideHistory:Object.hasOwn(historyEntries,key)||entries[key]?.overrideHistory===true});
const dateKey=day=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
function render(){
 title.textContent=overlay?`${year}年${month}月 配信カレンダー`:`${year}年 ${month}月`;
 grid.replaceChildren();
 const offset=new Date(year,month-1,1).getDay(),days=new Date(year,month,0).getDate();
 for(let i=0;i<offset;i++){const filler=document.createElement('div');filler.className='day is-empty';grid.append(filler);}
 for(let day=1;day<=days;day++){
  const key=dateKey(day),entry=currentEntry(key),cell=document.createElement(overlay?'div':'button');cell.className='day';
  if(!overlay){cell.type='button';cell.setAttribute('aria-label',`${month}月${day}日を編集`);cell.addEventListener('click',()=>select(key));}
  if(key===selected)cell.classList.add('is-selected');if(key===new Date().toLocaleDateString('sv-SE'))cell.classList.add('is-today');
  const top=document.createElement('span');top.className='day-top';cell.append(top);
  const number=document.createElement('span');number.className='day-number';number.textContent=day;top.append(number);
  if(sprites[entry.kind]){const sticker=document.createElement('span');sticker.className=`day-sticker kind-${entry.kind}`;sticker.append(pixelIcon(entry.kind));top.append(sticker);}
  if(entry.kind!=='rest'&&entry.startHour&&/^(?:1\d|2[0-3])$/.test(String(entry.startHour))){const time=document.createElement('span');time.className='day-time';time.textContent=`${entry.startHour}時〜`;top.append(time);}
  if(entry.text){const note=document.createElement('span');note.className='day-note';note.textContent=entry.text;cell.append(note);}
  grid.append(cell);
 }
}
function select(key){
 selected=key;const entry=currentEntry(key),recorded=Object.hasOwn(historyEntries,key),overridden=entries[key]?.overrideHistory===true;
 document.getElementById('day-editor').hidden=false;
 document.getElementById('selected-title').textContent=`${Number(key.slice(5,7))}月${Number(key.slice(8))}日の予定`;
 document.getElementById('event-text').value=entry.text||'';
 startHourSelect.value=String(entry.startHour||'');startHourSelect.disabled=entry.kind==='rest';
 document.querySelectorAll('.stickers button').forEach(b=>b.classList.toggle('selected',b.dataset.kind===entry.kind));
 const note=document.getElementById('recorded-note');note.hidden=!recorded;
 note.textContent=overridden?'この日は手入力の内容を表示しています。シートの記録に戻すこともできます。':'シートの記録を表示中。ここで編集すると、この日だけ手入力の内容を優先します。';
 document.getElementById('restore-sheet').hidden=!(recorded&&overridden);
 render();
}
async function refreshHistory(){try{const response=await fetch('/api/calendar-history',{cache:'no-store'});if(!response.ok)return;const data=await response.json();historyEntries=data.entries||{};render();if(!overlay){document.getElementById('history-status').textContent=data.synced?'配信履歴シートの記録を表示中。新しい記録は「履歴を更新」で確認できます。':'10月1〜10日の履歴を表示中。シートに接続できない場合は後で「履歴を更新」を押してください。';if(selected)select(selected);}}catch{}}
function draft(){revision++;pendingLocalEdits=true;try{localStorage.setItem(localKey,JSON.stringify(entries));localStorage.setItem(dirtyKey,'1');}catch{}document.getElementById('save-status').textContent='この端末に下書き保存しました。「反映」を押すとOBSへ送信します。';}
function showObsLink(){const output=document.getElementById('obs-url'),open=document.getElementById('obs-open');if(!calendarId){output.value='反映後に固定URLが表示されます';open.hidden=true;return '';}const link=new URL('calendar-view.html',location.href);link.searchParams.set('id',calendarId);output.value=link.href;open.href=link.href;open.hidden=false;return link.href;}
async function save(copy){
 if(loading){document.getElementById('save-status').textContent='保存先を確認中です。少し待ってから「反映」を押してください。';return;}if(saving)return;
 saving=true;const status=document.getElementById('save-status'),savedRevision=revision;
 try{const response=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:calendarId||undefined,entries})});const result=await response.json();if(!response.ok){if(response.status===401)canSync=false;throw Error(result.error||'保存できませんでした');}calendarId=result.id;localStorage.setItem(idKey,calendarId);if(revision===savedRevision){pendingLocalEdits=false;localStorage.removeItem(dirtyKey);}const link=showObsLink();status.textContent='反映しました。同じOBS用URLへ1分ほどで反映されます。';if(copy){try{await navigator.clipboard.writeText(link);status.textContent='OBS用URLをコピーしました。次回から貼り直しは不要です。';}catch{document.getElementById('obs-url').select();status.textContent='URLを選択しました。OBSには一度だけ貼ってください。';}}}
 catch(error){status.textContent=error.message+' 入力内容はこの端末に残っています。後で「反映」を押して再試行してください。';}
 finally{saving=false;if(revision!==savedRevision)status.textContent='反映中のあとに編集した内容が、この端末の下書きに残っています。「反映」をもう一度押してください。';}
}
async function load(){
 showObsLink();const startedAt=revision;let retry=false;
 try{const r=await fetch('/api/calendar?mine=1',{cache:'no-store'});
  if(r.status===401){canSync=false;document.getElementById('save-status').textContent='Twitchを接続すると固定URLへの反映が使えます。';return;}
  if(r.status===404){if(calendarId){const old=await fetch('/api/calendar?id='+encodeURIComponent(calendarId),{cache:'no-store'});if(old.ok&&!pendingLocalEdits&&revision===startedAt){entries=(await old.json()).entries||{};render();}else if(!old.ok&&old.status!==404)throw Error('以前のカレンダーを確認できませんでした');}document.getElementById('save-status').textContent='以前の固定URLは保持しています。変更後は「反映」を押してください。';return;}
  if(!r.ok)throw Error('カレンダーを読み込めませんでした');
  const data=await r.json();calendarId=data.id;localStorage.setItem(idKey,calendarId);showObsLink();if(!pendingLocalEdits&&revision===startedAt){entries=data.entries||{};localStorage.setItem(localKey,JSON.stringify(entries));render();}else document.getElementById('save-status').textContent='未反映の下書きがあります。「反映」を押してください。';if(!pendingLocalEdits)document.getElementById('save-status').textContent='固定URLを確認しました。編集後は「反映」を押してください。';
 }catch{retry=true;document.getElementById('save-status').textContent='保存先を確認できません。下書きはこの端末に残っています。再読み込み後に「反映」を押してください。';}
 finally{loading=false;}
}
render();
if(!overlay){const status=document.createElement('p');status.id='history-status';status.setAttribute('role','status');status.textContent='2026年10月以降の配信履歴を読み込み中…';document.querySelector('.editor-card').prepend(status);const note=document.createElement('p');note.id='recorded-note';note.hidden=true;document.getElementById('day-editor').prepend(note);}
if(!snapshot){refreshHistory();}
if(overlay){
 if(snapshot){try{entries=decodeSnapshot(snapshot);render();}catch(error){document.body.textContent=error.message;}}
 const id=snapshot?'':params.get('id')||'';let previous='';
 async function refresh(){if(!id)return;try{const r=await fetch('/api/calendar?id='+encodeURIComponent(id),{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(data.updatedAt!==previous){previous=data.updatedAt;entries=data.entries||{};render();}}catch{}}
 refresh();if(id)setInterval(refresh,60000);
}else{
 document.getElementById('previous').addEventListener('click',()=>{month--;if(month===0){month=12;year--;}selected='';render();});
 document.getElementById('next').addEventListener('click',()=>{month++;if(month===13){month=1;year++;}selected='';render();});
 document.getElementById('today').addEventListener('click',()=>{year=now.getFullYear();month=now.getMonth()+1;selected='';render();});
 document.querySelectorAll('.stickers button').forEach(button=>button.addEventListener('click',()=>{if(!selected)return;const current=currentEntry(selected);const kind=current.kind===button.dataset.kind?'':button.dataset.kind;entries[selected]=editedEntry(selected,{kind,startHour:kind==='rest'?'':current.startHour||''});select(selected);draft();}));
 startHourSelect.addEventListener('change',event=>{if(!selected)return;entries[selected]=editedEntry(selected,{startHour:event.target.value});select(selected);draft();});
 document.getElementById('event-text').addEventListener('input',event=>{if(!selected)return;entries[selected]=editedEntry(selected,{text:event.target.value});if(Object.hasOwn(historyEntries,selected)){document.getElementById('restore-sheet').hidden=false;document.getElementById('recorded-note').textContent='この日は手入力の内容を表示しています。シートの記録に戻すこともできます。';}render();draft();});
 document.getElementById('clear-day').addEventListener('click',()=>{if(!selected)return;entries[selected]=editedEntry(selected,{kind:'',text:'',startHour:''});select(selected);draft();});
 document.getElementById('restore-sheet').addEventListener('click',()=>{if(!selected||!Object.hasOwn(historyEntries,selected))return;delete entries[selected];select(selected);draft();});
 document.getElementById('publish').addEventListener('click',()=>save(true));
 document.getElementById('calendar-apply').addEventListener('click',()=>save(false));
 document.getElementById('refresh-history').addEventListener('click',()=>refreshHistory());
 document.getElementById('backup-publish').addEventListener('click',async()=>{
  const status=document.getElementById('backup-status'),out=document.getElementById('backup-obs-url');
  try{const url=new URL('calendar-view.html',location.href);url.search='';url.searchParams.set('year',String(year));url.searchParams.set('month',String(month));url.searchParams.set('snapshot',encodeSnapshot(snapshotData()));out.value=url.href;
   try{await navigator.clipboard.writeText(url.href);status.textContent='予備URLをコピーしました。OBSに貼り付けてください。';}catch{out.select();status.textContent='予備URLを選択しました。OBSに貼り付けてください。';}
  }catch(error){status.textContent=error.message;}
 });
 load();
}
