import {handle,json,owner,sameOrigin,get,set,remove,body} from '../lib/store.js';
import {botKey,cleanBotConfig} from '../lib/bot.js';
export const config={runtime:'edge'};
export default handle(async req=>{
 const account=await owner(req);
 if(req.method==='GET')return json({config:await get(botKey(account))||{enabled:false,commands:[],promos:[],interval:30},lastPromo:await get('bot-last-promo:'+account),error:await get('bot-error:'+account)});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 sameOrigin(req);let config;try{config=cleanBotConfig(await body(req,15000));}catch(error){return json({error:error.message},400);}
 if(config.enabled)return json({error:'無料枠を守るため、未使用のチャット自動返信・定期投稿は停止中です。'},409);
 await set(botKey(account),config,31536000);
 if(!config.enabled)await remove('bot-error:'+account);
 return json({config});
});
