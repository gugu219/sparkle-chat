import {handle,json,get,command} from '../lib/store.js';
import {events} from '../lib/events.js';
import {syncDonations} from '../lib/streamlabs.js';
import {credentials} from '../lib/twitch.js';
export const config={runtime:'edge'};
export default handle(async req=>{
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const u=new URL(req.url),key=u.searchParams.get('id');if(!/^[a-f0-9]{64}$/.test(key||''))return json({error:'Invalid overlay'},400);
 const account=await get('overlay:'+key);if(!account)return json({error:'出力URLが無効です。再発行してください。'},404);
 await credentials(account);
 const integrations=await syncDonations(account),stream=await get('stream:'+account);
 let streaks={};if(stream?.live){const flat=await command('HGETALL','streaks:'+account+':'+stream.id);for(let i=0;i<flat.length;i+=2)streaks[flat[i]]=JSON.parse(flat[i+1]);}
 const after=Number(u.searchParams.get('after'))||Date.now();const batch=await events(account,Math.max(after,Date.now()-120000));
 return json({events:batch,now:batch.length?Math.max(...batch.map(e=>e.receivedAt)):Date.now(),stream:{...stream,streaks},hype:await get('hype:'+account),widgets:u.searchParams.get('widgets')==='1'?{doneru:integrations?.doneru||'',streamlabs:integrations?.mode==='api'?'':integrations?.streamlabs||''}:undefined,streamlabsStatus:await get('sl-status:'+account)});
});
