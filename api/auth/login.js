import {handle,json,random,set,base} from '../../lib/store.js';
import {scopes} from '../../lib/twitch.js';
export const config={runtime:'edge'};
export default handle(async req=>{
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 if(!process.env.TWITCH_CLIENT_ID||!process.env.TWITCH_CLIENT_SECRET||!process.env.APP_ENCRYPTION_KEY||!(process.env.TWITCH_WEBHOOK_SECRET?.length>=32))throw Error('Twitch連携の環境変数が未設定です。セットアップ手順を確認してください。');
 if(new URL(req.url).origin!==base())throw Error('APP_BASE_URLと現在のサイトURLが一致しません。本番ドメインを確認してください。');
 const state=random();await set('oauth-state:'+state,true,600);
 const p=new URLSearchParams({client_id:process.env.TWITCH_CLIENT_ID,response_type:'code',redirect_uri:base()+'/api/auth/callback',scope:scopes.join(' '),state});
 return new Response(null,{status:302,headers:{Location:'https://id.twitch.tv/oauth2/authorize?'+p,'Set-Cookie':`sparkle_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,'Cache-Control':'no-store'}});
});
