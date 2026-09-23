import {handle,cookie,random,base,command,get,set,seal} from '../../lib/store.js';
import {token,subscribe} from '../../lib/twitch.js';
export const config={runtime:'edge'};
export default handle(async req=>{
 const u=new URL(req.url),state=cookie(req,'sparkle_state');
 if(!state||state!==u.searchParams.get('state')||!await command('GETDEL','oauth-state:'+state))return new Response('認証の有効期限が切れました。設定画面から再接続してください。',{status:403});
 if(u.searchParams.has('error'))return Response.redirect(base()+'/?auth=denied',303);
 if(!u.searchParams.get('code'))return new Response('認証コードがありません。',{status:400});
 const t=await token({grant_type:'authorization_code',code:u.searchParams.get('code'),redirect_uri:base()+'/api/auth/callback'});
 const response=await fetch('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:'OAuth '+t.access_token}});if(!response.ok)throw Error('Twitch認証を検証できませんでした。');const me=await response.json();
 const account=await get('twitch-user:'+me.user_id)||random(),owner=random();
 await set('twitch-user:'+me.user_id,account,31536000);await set('owner:'+owner,account);
 await set('twitch:'+account,await seal({accessToken:t.access_token,refreshToken:t.refresh_token,expiresAt:Date.now()+t.expires_in*1000,validatedAt:Date.now(),login:me.login,userId:me.user_id}));
 let profile=await get('profile:'+account);if(!profile){profile={overlay:random(),login:me.login};}else if(!await get('overlay:'+profile.overlay)){profile.overlay=random();}await set('overlay:'+profile.overlay,account,31536000);await set('profile:'+account,profile,31536000);
 const live=await fetch('https://api.twitch.tv/helix/streams?user_id='+me.user_id,{headers:{Authorization:'Bearer '+t.access_token,'Client-Id':process.env.TWITCH_CLIENT_ID}});
 if(live.ok){const s=(await live.json()).data?.[0];await set('stream:'+account,{id:s?.id||null,live:!!s,time:s?.started_at||new Date().toISOString()});}
 await subscribe(account);
 const headers=new Headers({Location:base()+'/?auth=connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 headers.append('Set-Cookie',`sparkle_owner=${owner}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);headers.append('Set-Cookie','sparkle_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
 return new Response(null,{status:303,headers});
});
