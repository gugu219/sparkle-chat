import {handle,json,owner,sameOrigin,body,get,set,random} from '../lib/store.js';

export const config={runtime:'edge'};
const kinds=new Set(['sub','resub','gift','follow','bits','points','donate','streak','hype']);
const clean=(value,max)=>String(value??'').slice(0,max);

// Short-lived render command: never append to the persistent event log.
export default handle(async req=>{
 const url=new URL(req.url);
 if(req.method==='GET'){
  const overlay=url.searchParams.get('overlay')||'';
  if(!/^[a-f0-9]{64}$/.test(overlay))return json({error:'Invalid overlay'},400);
  return json({event:await get('obs-test:'+overlay)});
 }
 if(req.method==='POST'){
  sameOrigin(req);
  const account=await owner(req),profile=await get('profile:'+account);
  if(!/^[a-f0-9]{64}$/.test(profile?.overlay||''))return json({error:'OBS通知にはTwitch接続が必要です。'},401);
  const input=await body(req,2000);
  if(!kinds.has(input?.event))return json({error:'テストの種類が正しくありません。'},400);
  const packet={id:random(),sentAt:Date.now(),event:input.event,name:'テストユーザー',
   detail:clean(input.detail,80),num:Math.min(50000,Math.max(0,Number(input.num)||0)),
   numLabel:clean(input.numLabel,20),numPrefix:clean(input.numPrefix,3)};
  await set('obs-test:'+profile.overlay,packet,45);
  return json({ok:true,id:packet.id});
 }
 return json({error:'Method not allowed'},405);
});
