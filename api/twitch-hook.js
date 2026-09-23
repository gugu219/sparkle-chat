import {handle,json,get,set,command} from '../lib/store.js';
import {append,normalizeTwitch} from '../lib/events.js';
export const config={runtime:'edge'};
export default handle(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const id=req.headers.get('Twitch-Eventsub-Message-Id'),time=req.headers.get('Twitch-Eventsub-Message-Timestamp'),sig=req.headers.get('Twitch-Eventsub-Message-Signature')||'';
 if(!id||!time||!Number.isFinite(Date.parse(time))||Math.abs(Date.now()-Date.parse(time))>600000)return json({error:'Expired message'},403);
 const text=await req.text();if(text.length>1000000)return json({error:'Too large'},413);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(process.env.TWITCH_WEBHOOK_SECRET||''),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!/^sha256=[a-f0-9]{64}$/.test(sig))return json({error:'Invalid signature'},403);
 const bytes=Uint8Array.from(sig.slice(7).match(/../g),s=>parseInt(s,16));
 if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(id+time+text)))return json({error:'Invalid signature'},403);
 const data=JSON.parse(text),kind=req.headers.get('Twitch-Eventsub-Message-Type');
 if(kind==='webhook_callback_verification')return new Response(data.challenge,{headers:{'Content-Type':'text/plain'}});
 const account=await get('twitch-user:'+data.subscription?.condition?.broadcaster_user_id);if(!account)return new Response(null,{status:204});
 if(kind==='revocation'){await set('connection-error:'+account,'Twitchが購読を解除しました。再接続してください。');return new Response(null,{status:204});}
 const event=normalizeTwitch(data.subscription.type,data.event,id,time);
 if(await append(account,event)){
  if(event.type==='stream.online')await set('stream:'+account,{id:event.streamId,live:true,time,streaks:{}});
  if(event.type==='stream.offline'){const s=await get('stream:'+account)||{};if(!s.time||Date.parse(time)>=Date.parse(s.time))await set('stream:'+account,{id:s.id,live:false,time,streaks:{}});}
  if(event.type==='streak'&&event.userId){
   // Individual hash fields avoid lost updates from simultaneous viewers.
   const stream=await get('stream:'+account);if(stream?.live && Date.parse(time)>=Date.parse(stream.time)){
    await command('HSET','streaks:'+account+':'+stream.id,event.userId,JSON.stringify({count:event.count,name:event.name}));await command('EXPIRE','streaks:'+account+':'+stream.id,172800);
   }
  }
  if(event.type==='hype')await set('hype:'+account,event,3600);
 }
 return new Response(null,{status:204});
});
