import {handle,json,get} from '../lib/store.js';
import {events} from '../lib/events.js';

export const config={runtime:'edge'};

// Lightweight, uncached notification path for open OBS browser sources.
export default handle(async req=>{
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const url=new URL(req.url),overlay=url.searchParams.get('overlay')||'';
 if(!/^[a-f0-9]{64}$/.test(overlay))return json({error:'Invalid overlay'},400);
 const account=await get('overlay:'+overlay);
 if(!account)return json({error:'出力URLが無効です。再発行してください。'},404);
 const now=Date.now(),after=Math.min(now,Math.max(0,Number(url.searchParams.get('after'))||now));
 const [batch,test]=await Promise.all([
  events(account,Math.max(0,after-5000)),
  get('obs-test:'+overlay)
 ]);
 return json({events:batch,test,now});
});
