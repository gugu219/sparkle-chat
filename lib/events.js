import {command,get,set,random} from './store.js';
export const RETENTION=30*86400;
const LIVE_RETENTION=300;
export function normalizeTwitch(type,e,id,time){
 const common={id,source:'twitch',type,time,name:e.user_name||e.chatter_user_name||null,userId:e.user_id||e.chatter_user_id||null,message:e.message?.text||null};
 if(type==='channel.follow')return {...common,type:'follow'};
 if(type==='channel.chat.notification'){
  if(e.source_broadcaster_user_id && e.source_broadcaster_user_id!==e.broadcaster_user_id)return null;
  const n=e.notice_type,v=e[n]||{};
  if(n==='watch_streak')return {...common,type:'streak',count:v.streak_count};
  if(n==='sub'||n==='resub')return {...common,type:n,tier:v.sub_tier||null,months:v.cumulative_months??v.duration_months??null,gift:v.is_gift??null};
  if(n==='sub_gift'&&v.community_gift_id)return null;
  if(n==='sub_gift'||n==='community_sub_gift')return {...common,type:'gift',tier:v.sub_tier||null,count:v.total??1,recipient:v.recipient_user_name||null};
  return null;
 }
 if(type==='channel.cheer')return {...common,type:'bits',amount:e.bits,message:e.message||null};
 if(type.startsWith('channel.hype_train.'))return {...common,type:'hype',phase:type.split('.').at(-1),hype:e};
 if(type==='stream.online'||type==='stream.offline')return {...common,type:type,streamId:e.id||null};
 return null;
}
export async function append(account,event){
 if(!event)return false;
 if(!await command('SET','event-seen:'+account+':'+event.id,'1','NX','EX',RETENTION))return false;
 const score=Date.now();event.receivedAt=score;
 await set('live-event:'+account+':'+event.id,event,LIVE_RETENTION);
 await command('ZADD','live-events:'+account,score,event.id);
 await command('ZREMRANGEBYSCORE','live-events:'+account,'-inf',score-LIVE_RETENTION*1000);
 await command('EXPIRE','live-events:'+account,LIVE_RETENTION);
 if(event.type==='streak'&&!event.test){
  await set('event:'+account+':'+event.id,event,RETENTION);
  await command('ZADD','events:'+account,score,event.id);
  await command('ZREMRANGEBYSCORE','events:'+account,'-inf',score-RETENTION*1000);
  await command('EXPIRE','events:'+account,RETENTION);
 }
 return true;
}
export async function events(account,after=0,limit=200){
 const ids=await command('ZRANGEBYSCORE','live-events:'+account,Math.max(after,Date.now()-LIVE_RETENTION*1000),'+inf','LIMIT',0,limit);
 if(!ids.length)return [];
 const values=await command('MGET',...ids.map(id=>'live-event:'+account+':'+id));
 return values.filter(Boolean).map(v=>typeof v==='string'?JSON.parse(v):v);
}
export async function recent(account){const ids=await command('ZREVRANGEBYSCORE','events:'+account,'+inf',Date.now()-RETENTION*1000,'LIMIT',0,1000);if(!ids.length)return [];return (await command('MGET',...ids.map(id=>'event:'+account+':'+id))).filter(Boolean).map(v=>typeof v==='string'?JSON.parse(v):v).filter(v=>v.type==='streak'&&!v.test).slice(0,300);}
export const testEvent = (source,type='donation') => ({id:random(),source,type,test:true,time:new Date().toISOString(),name:'Mika',...(type==='donation'?{amount:'1000',currency:'JPY',message:'いつも楽しい配信をありがとう！'}:{userId:'demo-mika',count:12})});
