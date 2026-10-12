import {handle,json,owner,sameOrigin,get,set,remove,body} from '../lib/store.js';
import {botKey,cleanBotConfig} from '../lib/bot.js';
import {subscribe} from '../lib/twitch.js';
export default handle(async req=>{
 const account=await owner(req);
 if(req.method==='GET')return json({config:await get(botKey(account))||{enabled:false,commands:[],promos:[],interval:30},lastPromo:await get('bot-last-promo:'+account),error:await get('bot-error:'+account)});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 sameOrigin(req);let config;try{config=cleanBotConfig(await body(req,15000));}catch(error){return json({error:error.message},400);}
 if(config.enabled){const results=await subscribe(account);const chat=results.find(item=>item.type==='channel.chat.message');if(!chat?.ok)return json({error:'Twitchチャット受信を有効にできませんでした。Twitchに再接続してください。'},409);}
 await set(botKey(account),config,31536000);
 if(!config.enabled)await remove('bot-error:'+account);
 return json({config});
});
