import {handle,json,owner,set,sameOrigin,body} from '../lib/store.js';
import {recent,append,testEvent} from '../lib/events.js';
export const config={runtime:'edge'};
export default handle(async req=>{
 const account=await owner(req);
 if(req.method==='GET')return json({events:await recent(account)});
 if(req.method==='POST'){
  sameOrigin(req);const b=await body(req);
  if(b.action==='end-stream'){await set('stream:'+account,{id:null,live:false,time:new Date().toISOString()});return json({ok:true});}
  if(b.action==='test'&&['doneru','streamlabs','twitch'].includes(b.source)){const e=testEvent(b.source,b.source==='twitch'?'streak':'donation');await append(account,e);return json({event:e});}
 }
 return json({error:'Method not allowed'},405);
});
