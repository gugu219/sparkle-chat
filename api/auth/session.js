import {handle,json,owner,get,remove,cookie,sameOrigin,unseal} from '../../lib/store.js';
import {credentials,subscribe} from '../../lib/twitch.js';
export const config={runtime:'edge'};
export default handle(async req=>{
 const account=await owner(req);
 if(req.method==='DELETE'){
  sameOrigin(req);const raw=await get('twitch:'+account);if(raw){const c=await unseal(raw);await fetch('https://id.twitch.tv/oauth2/revoke',{method:'POST',body:new URLSearchParams({client_id:process.env.TWITCH_CLIENT_ID,token:c.accessToken})});}
  await remove('twitch:'+account);await remove('owner:'+cookie(req,'sparkle_owner'));const p=await get('profile:'+account);if(p)await remove('overlay:'+p.overlay);
  return json({ok:true});
 }
 if(req.method==='POST'){sameOrigin(req);await subscribe(account);await remove('connection-error:'+account);}
 else if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const p=await get('profile:'+account);
 if(!p?.overlay)return json({error:'Twitchに再接続してください。'},401);
 let c,error=await get('connection-error:'+account);
 try{c=await credentials(account);}catch(e){error='Twitchは再認証が必要です。保存済みの外部通知は利用できます。';}
 return json({login:c?.login||p.login||account,overlay:p.overlay,subscriptions:await get('subscriptions:'+account)||[],error});
});
