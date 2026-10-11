// Tiny hand-drawn sprites stay sharp in both the editor and the OBS browser source.
const sprites={
 stream:['............','.ppp...ppp..','pphhp.pphhp.','phhhppphhhp.','phhhhhhhhp..','.phhhhhhp...','..phhhhp....','...phhp.....','....pp......'],
 rest:['............','dd......dd..','.dd....dd...','..dd..dd....','...dddd.....','....dd......','...dddd.....','..dd..dd....','.dd....dd...','dd......dd..'],
 game:['............','..dddddddd..','.dggggggggd.','dggdg..gdggd','dggddd.gdggd','dggdg..gdggd','dggggggggggd','.dggggggggd.','..dd....dd..'],
 chat:['............','..dddddddd..','.dccccccccd.','dccccccccccd','dccccccccccd','dccccccccccd','.dccccccccd.','..dddccddd..','...dccc.....','....dd......'],
 drink:['............','..dddddddd..','..drrrrrrd..','...drrrrd...','....drrd....','.....dd.....','.....dd.....','.....dd.....','...dddddd...']
};
const spriteColors={stream:{p:'#9b536f',h:'#f7a9bd'},rest:{d:'#877c87'},game:{d:'#5a647a',g:'#a8c9a6'},chat:{d:'#826879',c:'#f5cbb1'},drink:{d:'#786079',r:'#bc7896'}};
function pixelIcon(kind){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 12 10');svg.setAttribute('aria-hidden','true');svg.classList.add('pixel-icon');
 const colors=spriteColors[kind]||{};
 (sprites[kind]||[]).forEach((row,y)=>[...row].forEach((pixel,x)=>{if(!colors[pixel])return;const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',x);rect.setAttribute('y',y);rect.setAttribute('width',1);rect.setAttribute('height',1);rect.setAttribute('fill',colors[pixel]);svg.append(rect);}));
 return svg;
}
document.querySelectorAll('.sticker-guide span').forEach((label,index)=>{const kind=Object.keys(sprites)[index];label.textContent=label.textContent.replace(/^[^ ]+ /,'');label.prepend(pixelIcon(kind));});
document.querySelectorAll('.stickers button').forEach(button=>{button.firstChild?.remove();button.prepend(pixelIcon(button.dataset.kind));});
const localKey='sparkle-calendar-draft',idKey='sparkle-calendar-id';
const overlay=document.body.classList.contains('calendar-overlay');
const params=new URLSearchParams(location.search);
const now=new Date();let year=Number(params.get('year'))||now.getFullYear(),month=Number(params.get('month'))||now.getMonth()+1;
if(month<1||month>12){year=now.getFullYear();month=now.getMonth()+1;}
let entries={},historyEntries={},selected='',calendarId='';
try{if(!overlay){entries=JSON.parse(localStorage.getItem(localKey)||'{}');calendarId=localStorage.getItem(idKey)||'';}}catch{}
const grid=document.getElementById('calendar-grid'),title=document.getElementById('month-title');
const dateKey=day=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
function render(){
 title.textContent=`${year}年 ${month}月`;
 grid.replaceChildren();
 const offset=new Date(year,month-1,1).getDay(),days=new Date(year,month,0).getDate();
 for(let i=0;i<offset;i++){const filler=document.createElement('div');filler.className='day is-empty';grid.append(filler);}
 for(let day=1;day<=days;day++){
  const key=dateKey(day),entry=entries[key]||historyEntries[key]||{},cell=document.createElement(overlay?'div':'button');cell.className='day';
  if(!overlay){cell.type='button';cell.setAttribute('aria-label',`${month}月${day}日を編集`);cell.addEventListener('click',()=>select(key));}
  if(key===selected)cell.classList.add('is-selected');if(key===new Date().toLocaleDateString('sv-SE'))cell.classList.add('is-today');
  const number=document.createElement('span');number.className='day-number';number.textContent=day;cell.append(number);
  if(sprites[entry.kind]){const sticker=document.createElement('span');sticker.className=`day-sticker kind-${entry.kind}`;sticker.append(pixelIcon(entry.kind));cell.append(sticker);}
  if(entry.text){const note=document.createElement('span');note.className='day-note';note.textContent=entry.text;cell.append(note);}
  grid.append(cell);
 }
}
function select(key){selected=key;const entry=entries[key]||historyEntries[key]||{};document.getElementById('day-editor').hidden=false;document.getElementById('selected-title').textContent=`${Number(key.slice(5,7))}月${Number(key.slice(8))}日の予定`;document.getElementById('event-text').value=entry.text||'';document.querySelectorAll('.stickers button').forEach(b=>b.classList.toggle('selected',b.dataset.kind===entry.kind));render();}
async function refreshHistory(){try{const response=await fetch('/api/calendar-history',{cache:'no-store'});if(!response.ok)return;const data=await response.json();historyEntries=data.entries||{};render();if(!overlay)document.getElementById('history-status').textContent=data.synced?'配信履歴シートと同期中。追記は約5分以内に反映されます。':'10月1〜10日の履歴を表示中。シートへの接続を再試行します。';}catch{}}
function draft(){try{localStorage.setItem(localKey,JSON.stringify(entries));}catch{}document.getElementById('save-status').textContent=calendarId?'変更を保存しています…':'この端末に下書き保存しました。';if(calendarId){clearTimeout(draft.timer);draft.timer=setTimeout(()=>save(false),700);}}
async function save(copy){const status=document.getElementById('save-status');try{const response=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:calendarId||undefined,entries})});const result=await response.json();if(!response.ok)throw Error(result.error||'保存できませんでした');calendarId=result.id;localStorage.setItem(idKey,calendarId);const link=new URL('calendar-view.html',location.href);link.searchParams.set('id',calendarId);document.getElementById('obs-url').value=link.href;status.textContent='保存済み。OBSには数秒以内に反映されます。';if(copy){try{await navigator.clipboard.writeText(link.href);status.textContent='専用URLをコピーしました。OBSの別ブラウザソースに貼ってください。';}catch{document.getElementById('obs-url').select();status.textContent='URLを選択しました。コピーしてOBSに貼ってください。';}}}catch(error){status.textContent=error.message+' 入力内容はこの端末に残っています。';}}
async function load(){if(!calendarId)return;const link=new URL('calendar-view.html',location.href);link.searchParams.set('id',calendarId);document.getElementById('obs-url').value=link.href;try{const r=await fetch('/api/calendar?id='+encodeURIComponent(calendarId),{cache:'no-store'});if(!r.ok)return;const data=await r.json();entries=data.entries||{};render();}catch{}}
render();
if(!overlay){const status=document.createElement('p');status.id='history-status';status.setAttribute('role','status');status.textContent='2026年10月以降の配信履歴を読み込み中…';document.querySelector('.editor-card').prepend(status);}
refreshHistory();setInterval(refreshHistory,5*60*1000);
if(overlay){
 const id=params.get('id')||'';let previous='';
 async function refresh(){if(!id)return;try{const r=await fetch('/api/calendar?id='+encodeURIComponent(id),{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(data.updatedAt!==previous){previous=data.updatedAt;entries=data.entries||{};render();}}catch{}}
 refresh();setInterval(refresh,5000);
}else{
 document.getElementById('previous').addEventListener('click',()=>{month--;if(month===0){month=12;year--;}selected='';render();});
 document.getElementById('next').addEventListener('click',()=>{month++;if(month===13){month=1;year++;}selected='';render();});
 document.getElementById('today').addEventListener('click',()=>{year=now.getFullYear();month=now.getMonth()+1;selected='';render();});
 document.querySelectorAll('.stickers button').forEach(button=>button.addEventListener('click',()=>{if(!selected)return;const current=entries[selected]||historyEntries[selected]||{};const kind=current.kind===button.dataset.kind?'':button.dataset.kind;entries[selected]={...current,kind};select(selected);draft();}));
 document.getElementById('event-text').addEventListener('input',event=>{if(!selected)return;entries[selected]={...(entries[selected]||historyEntries[selected]||{}),text:event.target.value};render();draft();});
 document.getElementById('clear-day').addEventListener('click',()=>{entries[selected]={kind:'',text:''};select(selected);draft();});
 document.getElementById('publish').addEventListener('click',()=>save(true));
 load();
}
