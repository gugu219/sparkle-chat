import {get,set,seal,unseal,base} from './store.js';
export const scopes=['channel:read:hype_train','moderator:read:followers','user:read:chat','user:bot','channel:bot','bits:read'];
export async function token(params){const r=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:process.env.TWITCH_CLIENT_ID,client_secret:process.env.TWITCH_CLIENT_SECRET,...params})});const data=await r.json();if(!r.ok)throw Error('Twitch認証に失敗しました。Client ID・Secret・リダイレクトURLを確認してください。');return data;}
export async function credentials(account){
 let c=await get('twitch:'+account);if(!c)throw Error('Twitchに再接続してください。');c=await unseal(c);
 if(c.expiresAt<Date.now()+120000){const t=await token({grant_type:'refresh_token',refresh_token:c.refreshToken});Object.assign(c,{accessToken:t.access_token,refreshToken:t.refresh_token||c.refreshToken,expiresAt:Date.now()+t.expires_in*1000});}
 if(!c.validatedAt||c.validatedAt<Date.now()-3600000){const r=await fetch('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:'OAuth '+c.accessToken}});if(!r.ok)throw Error('Twitchに再接続してください。');c.validatedAt=Date.now();}
 await set('twitch:'+account,await seal(c));return c;
}
export async function appToken(){let c=await get('twitch-app-token');if(c&&c.expiresAt>Date.now()+60000)return (await unseal(c.secret)).access_token;const t=await token({grant_type:'client_credentials'});await set('twitch-app-token',{expiresAt:Date.now()+t.expires_in*1000,secret:await seal(t)},Math.max(1,t.expires_in-60));return t.access_token;}
export async function subscribe(account){
 const c=await credentials(account),access=await appToken();
 const types=[['channel.hype_train.begin','2'],['channel.hype_train.progress','2'],['channel.hype_train.end','2'],['channel.follow','2'],['channel.chat.notification','1'],['channel.cheer','1'],['stream.online','1'],['stream.offline','1']];
 const results=await Promise.all(types.map(async([type,version])=>{
  const condition={broadcaster_user_id:c.userId};if(type==='channel.follow')condition.moderator_user_id=c.userId;if(type==='channel.chat.notification')condition.user_id=c.userId;
  const r=await fetch('https://api.twitch.tv/helix/eventsub/subscriptions',{method:'POST',headers:{Authorization:'Bearer '+access,'Client-Id':process.env.TWITCH_CLIENT_ID,'Content-Type':'application/json'},body:JSON.stringify({type,version,condition,transport:{method:'webhook',callback:base()+'/api/twitch-hook',secret:process.env.TWITCH_WEBHOOK_SECRET}})});
  return {type,ok:r.ok||r.status===409,status:r.status};
 }));
 await set('subscriptions:'+account,results);return results;
}
