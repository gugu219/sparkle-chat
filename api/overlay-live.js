import {handle,json,command} from '../lib/store.js';

export const config={runtime:'edge'};

// Old OBS sources may keep requesting every 1.8s until they reload.
// Briefly cache their reads; refreshed sources use a slower schedule.
const cache=new Map(),legacyCacheMs=15000;
export default handle(async req=>{
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const url=new URL(req.url),overlay=url.searchParams.get('overlay')||'';
 if(!/^[a-f0-9]{64}$/.test(overlay))return json({error:'Invalid overlay'},400);
 const version=url.searchParams.get('v'),modern=version==='2',shared=version==='3';
 let items;
 const cached=cache.get(overlay);
 if(!modern&&cached&&Date.now()-cached.at<(shared?12000:legacyCacheMs))items=cached.items;
 else{
  items=await command('LRANGE','live-feed:'+overlay,0,99);
  cache.set(overlay,{at:Date.now(),items});
  if(cache.size>100)cache.delete(cache.keys().next().value);
 }
 const after=shared?0:Number(url.searchParams.get('after'))||0;
 const packets=items.map(value=>{try{return JSON.parse(value);}catch{return null;}}).filter(Boolean);
 const events=packets.filter(x=>x.kind==='event'&&x.data?.receivedAt>=after-5000).map(x=>x.data).reverse();
 const test=packets.find(x=>x.kind==='test')?.data||null;
 if(shared)return Response.json({events,test,now:Date.now()},{headers:{'Cache-Control':'public, max-age=0','Vercel-CDN-Cache-Control':'public, s-maxage=12, stale-while-revalidate=5','Referrer-Policy':'no-referrer'}});
 return json({events,test,now:Date.now()});
});
