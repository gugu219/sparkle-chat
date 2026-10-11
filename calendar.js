const symbols={stream:'♥',rest:'×',game:'🎮',chat:'☕',drink:'🍷'};
const localKey='sparkle-calendar-draft',idKey='sparkle-calendar-id';
const overlay=document.body.classList.contains('calendar-overlay');
const params=new URLSearchParams(location.search);
const now=new Date();let year=Number(params.get('year'))||now.getFullYear(),month=Number(params.get('month'))||now.getMonth()+1;
if(month<1||month>12){year=now.getFullYear();month=now.getMonth()+1;}
let entries={},selected='',calendarId='';
try{if(!overlay){entries=JSON.parse(localStorage.getItem(localKey)||'{}');calendarId=localStorage.getItem(idKey)||'';}}catch{}
const grid=document.getElementById('calendar-grid'),title=document.getElementById('month-title');
const dateKey=day=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
function render(){
 title.textContent=`${year}年 ${month}月`;
 grid.replaceChildren();
 const offset=new Date(year,month-1,1).getDay(),days=new Date(year,month,0).getDate();
 for(let i=0;i<offset;i++){const filler=document.createElement('div');filler.className='day is-empty';grid.append(filler);}
 for(let day=1;day<=days;day++){
  const key=dateKey(day),entry=entries[key]||{},cell=document.createElement(overlay?'div':'button');cell.className='day';
  if(!overlay){cell.type='button';cell.setAttribute('aria-label',`${month}月${day}日を編集`);cell.addEventListener('click',()=>select(key));}
  if(key===selected)cell.classList.add('is-selected');if(key===new Date().toLocaleDateString('sv-SE'))cell.classList.add('is-today');
  const number=document.createElement('span');number.className='day-number';number.textContent=day;cell.append(number);
  if(entry.kind){const sticker=document.createElement('span');sticker.className=`day-sticker kind-${entry.kind}`;sticker.textContent=symbols[entry.kind]||'';cell.append(sticker);}
  if(entry.text){const note=document.createElement('span');note.className='day-note';note.textContent=entry.text;cell.append(note);}
  grid.append(cell);
 }
}
function select(key){selected=key;document.getElementById('day-editor').hidden=false;document.getElementById('selected-title').textContent=`${Number(key.slice(5,7))}月${Number(key.slice(8))}日の予定`;document.getElementById('event-text').value=entries[key]?.text||'';document.querySelectorAll('.stickers button').forEach(b=>b.classList.toggle('selected',b.dataset.kind===entries[key]?.kind));render();}
function draft(){try{localStorage.setItem(localKey,JSON.stringify(entries));}catch{}document.getElementById('save-status').textContent=calendarId?'変更を保存しています…':'この端末に下書き保存しました。';if(calendarId){clearTimeout(draft.timer);draft.timer=setTimeout(()=>save(false),700);}}
async function save(copy){const status=document.getElementById('save-status');try{const response=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:calendarId||undefined,entries})});const result=await response.json();if(!response.ok)throw Error(result.error||'保存できませんでした');calendarId=result.id;localStorage.setItem(idKey,calendarId);const link=new URL('calendar-view.html',location.href);link.searchParams.set('id',calendarId);document.getElementById('obs-url').value=link.href;status.textContent='保存済み。OBSには数秒以内に反映されます。';if(copy){try{await navigator.clipboard.writeText(link.href);status.textContent='専用URLをコピーしました。OBSの別ブラウザソースに貼ってください。';}catch{document.getElementById('obs-url').select();status.textContent='URLを選択しました。コピーしてOBSに貼ってください。';}}}catch(error){status.textContent=error.message+' 入力内容はこの端末に残っています。';}}
async function load(){if(!calendarId)return;const link=new URL('calendar-view.html',location.href);link.searchParams.set('id',calendarId);document.getElementById('obs-url').value=link.href;try{const r=await fetch('/api/calendar?id='+encodeURIComponent(calendarId),{cache:'no-store'});if(!r.ok)return;const data=await r.json();entries=data.entries||{};render();}catch{}}
render();
if(overlay){
 const id=params.get('id')||'';let previous='';
 async function refresh(){if(!id)return;try{const r=await fetch('/api/calendar?id='+encodeURIComponent(id),{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(data.updatedAt!==previous){previous=data.updatedAt;entries=data.entries||{};render();}}catch{}}
 refresh();setInterval(refresh,5000);
}else{
 document.getElementById('previous').addEventListener('click',()=>{month--;if(month===0){month=12;year--;}selected='';render();});
 document.getElementById('next').addEventListener('click',()=>{month++;if(month===13){month=1;year++;}selected='';render();});
 document.getElementById('today').addEventListener('click',()=>{year=now.getFullYear();month=now.getMonth()+1;selected='';render();});
 document.querySelectorAll('.stickers button').forEach(button=>button.addEventListener('click',()=>{if(!selected)return;const kind=entries[selected]?.kind===button.dataset.kind?'':button.dataset.kind;entries[selected]={...(entries[selected]||{}),kind};select(selected);draft();}));
 document.getElementById('event-text').addEventListener('input',event=>{if(!selected)return;entries[selected]={...(entries[selected]||{}),text:event.target.value};render();draft();});
 document.getElementById('clear-day').addEventListener('click',()=>{delete entries[selected];select(selected);draft();});
 document.getElementById('publish').addEventListener('click',()=>save(true));
 load();
}
