import {owner,sameOrigin,get,set,random,json} from '../lib/store.js';

const kinds=new Set(['stream','rest','game','chat','drink']);
const key=id=>`calendar:${id}`;
export default async function(req){
 try{
  const url=new URL(req.url);
  if(req.method==='GET'){
   const id=url.searchParams.get('id')||'';
   if(!/^[a-f0-9]{32}$/.test(id))return json({error:'カレンダーが見つかりません'},404);
   const record=await get(key(id));
   return record?json({entries:record.entries,updatedAt:record.updatedAt}):json({error:'カレンダーが見つかりません'},404);
  }
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  sameOrigin(req);
  const account=await owner(req);
  const body=await req.json();
  const entries=body.entries;
  if(!entries||typeof entries!=='object'||Array.isArray(entries)||Object.keys(entries).length>500)return json({error:'予定の形式が正しくありません'},400);
  const clean={};
  for(const [date,entry] of Object.entries(entries)){
   if(!/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(date)||!entry||typeof entry!=='object'||Array.isArray(entry))return json({error:'日付が正しくありません'},400);
   const day=new Date(date+'T00:00:00Z');if(Number.isNaN(day.getTime())||day.toISOString().slice(0,10)!==date)return json({error:'日付が正しくありません'},400);
   const text=String(entry.text||'').trim();const kind=String(entry.kind||'');
   if(text.length>90||kind&&!kinds.has(kind))return json({error:'予定が長すぎるか、シールが正しくありません'},400);
   clean[date]={text,kind};
  }
  const id=String(body.id||'');
  if(id&&!/^[a-f0-9]{32}$/.test(id))return json({error:'リンクが正しくありません'},400);
  if(id){const existing=await get(key(id));if(!existing||existing.owner!==account)return json({error:'このカレンダーは更新できません'},403);}
  const calendarId=id||random().slice(0,32);
  const updatedAt=new Date().toISOString();
  await set(key(calendarId),{owner:account,entries:clean,updatedAt},60*60*24*365*2);
  return json({id:calendarId,updatedAt});
 }catch(e){return json({error:e.message||'保存に失敗しました'},e.message?.includes('再接続')?401:500);}
}
