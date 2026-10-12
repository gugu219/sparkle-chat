import {get,set,command,remove,unseal} from './store.js';
import {credentials} from './twitch.js';

export const botKey=account=>'bot:'+account;
const commandName=name=>String(name||'').trim().replace(/^!/, '').toLowerCase();
export function cleanBotConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('設定の形式が正しくありません。');
 if(!Array.isArray(input.commands)||input.commands.length>20||!Array.isArray(input.promos)||input.promos.length>10)throw Error('コマンドは20件、定期メッセージは10件までです。');
 const commands=input.commands.map(row=>({name:commandName(row?.name),response:String(row?.response||'').trim()}));
 const seen=new Set();for(const row of commands){if(!/^[\p{L}\p{N}_-]{1,30}$/u.test(row.name)||!row.response||row.response.length>450||seen.has(row.name))throw Error('コマンド名・返信文を確認してください。');seen.add(row.name);}
 const promos=input.promos.map(value=>String(value||'').trim());
 if(promos.some(value=>!value||value.length>450))throw Error('定期メッセージは450文字以内で入力してください。');
 const interval=Number(input.interval||30);if(![15,30,60].includes(interval))throw Error('定期投稿の間隔を確認してください。');
 return {enabled:input.enabled===true,commands,promos,interval};
}
export async function sendChatMessage(account,message,replyId){
 const c=await credentials(account),payload={broadcaster_id:c.userId,sender_id:c.userId,message};
 if(replyId)payload.reply_parent_message_id=replyId;
 const response=await fetch('https://api.twitch.tv/helix/chat/messages',{method:'POST',headers:{Authorization:'Bearer '+c.accessToken,'Client-Id':process.env.TWITCH_CLIENT_ID,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.data?.[0]?.is_sent!==true)throw Error(response.status===401?'Twitchの投稿権限が必要です。再接続してください。':result.data?.[0]?.drop_reason?.message||'Twitchへ投稿できませんでした。');
 return result.data[0].message_id;
}
export async function handleBotChat(account,event,eventId){
 const config=await get(botKey(account));if(!config?.enabled)return false;
 const credentialsForAccount=await get('twitch:'+account);if(!credentialsForAccount)return false;
 const message=String(event?.message?.text||'').trim();if(!message||!event?.chatter_user_id)return false;
 // This bot writes as the broadcaster. Ignore its own messages to prevent loops.
 const sender=(await unseal(credentialsForAccount)).userId;
 if(event.chatter_user_id===sender)return false;
 if(!await command('SET','bot-event:'+account+':'+eventId,'1','NX','EX',86400))return false;
 const matched=/^!([\p{L}\p{N}_-]{1,30})(?:\s|$)/u.exec(message);
 const name=matched?.[1]?.toLowerCase();const rule=name&&config.commands.find(item=>item.name===name);
 if(rule){
  if(await command('SET','bot-cooldown:'+account+':'+name,'1','NX','EX',5)){
   try{await sendChatMessage(account,rule.response,event.message_id);await remove('bot-error:'+account);}catch(error){await remove('bot-cooldown:'+account+':'+name);throw error;}
  }
  return true;
 }
 if(!config.promos.length)return false;
 const stream=await get('stream:'+account);if(!stream?.live)return false;
 const interval=config.interval*60000,streamStart=Date.parse(stream.time)||Date.now();
 if(Date.now()-streamStart<interval)return false;
 const slot=Math.floor((Date.now()-streamStart)/interval);
 const lock=`bot-promo:${account}:${stream.id||streamStart}:${slot}`;
 if(!await command('SET',lock,'1','NX','EX',Math.ceil(interval/1000)+3600))return false;
 try{await sendChatMessage(account,config.promos[(slot-1)%config.promos.length]);await remove('bot-error:'+account);}catch(error){await remove(lock);throw error;}
 await set('bot-last-promo:'+account,{at:new Date().toISOString(),text:config.promos[(slot-1)%config.promos.length]},86400);
 return true;
}
