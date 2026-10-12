import {handle,json,get,command} from '../lib/store.js';
import {events} from '../lib/events.js';
import {syncDonations} from '../lib/streamlabs.js';
import {credentials} from '../lib/twitch.js';
export const config={runtime:'edge'};
// Keep short-lived render state in each warm edge instance. Older OBS browser
// sources can keep polling every few seconds until the source is refreshed.
const renderCache=new Map(),cacheMs=20000;
export default handle(async req=>{
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const u=new URL(req.url),key=u.searchParams.get('id');if(!/^[a-f0-9]{64}$/.test(key||''))return json({error:'Invalid overlay'},400);
 const after=Number(u.searchParams.get('after'))||Date.now(),widgets=u.searchParams.get('widgets')==='1',cacheKey=key+':'+Number(widgets);
 let cached=renderCache.get(cacheKey);
 if(cached&&Date.now()-cached.at<cacheMs)return output(cached.payload,after,cached.cursorAt);
 const account=await get('overlay:'+key);if(!account)return json({error:'出力URLが無効です。再発行してください。'},404);
 // Widget delivery must survive an expired Twitch token. Report its health
 // separately so a Twitch outage cannot hide Doneru/Streamlabs notifications.
 let twitchStatus={ok:true};
 try{await credentials(account);}catch(e){twitchStatus={ok:false,error:e.message};}
 const integrations=await syncDonations(account),stream=await get('stream:'+account);
 let streaks={};if(stream?.live){const flat=await command('HGETALL','streaks:'+account+':'+stream.id);for(let i=0;i<flat.length;i+=2)streaks[flat[i]]=JSON.parse(flat[i+1]);}
 const cursorAt=Date.now(),batch=await events(account,cursorAt-120000);
 const payload={events:batch,stream:{...stream,streaks},hype:await get('hype:'+account),widgets:widgets?{doneru:integrations?.doneru||'',streamlabs:integrations?.mode==='api'?'':integrations?.streamlabs||''}:undefined,twitchStatus,streamlabsStatus:await get('sl-status:'+account)};
 if(renderCache.size>=100)renderCache.delete(renderCache.keys().next().value);
 cached={at:Date.now(),cursorAt,payload};renderCache.set(cacheKey,cached);
 return output(payload,after,cursorAt);
});
function output(payload,after,cursorAt){const batch=payload.events.filter(e=>e.receivedAt>=after);return json({...payload,events:batch,now:batch.length?Math.max(...batch.map(e=>e.receivedAt)):Math.max(after,cursorAt)});}
