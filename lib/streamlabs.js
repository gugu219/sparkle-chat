import {get,set,command,seal,unseal} from './store.js';
import {append} from './events.js';
export async function syncDonations(account){
 const raw=await get('integrations:'+account);if(!raw)return null;const c=await unseal(raw);
 if(c.mode!=='api'||!c.streamlabsToken)return c;
 if(!await command('SET','sl-poll:'+account,'1','NX','EX',15))return c;
 try{
  const previous=await get('sl-cursor:'+account);let before=null,data=[];
  for(let page=0;page<20;page++){
   const q=new URLSearchParams({limit:'100'});if(previous)q.set('after',String(previous));if(before)q.set('before',String(before));
   const r=await fetch('https://streamlabs.com/api/v2.0/donations?'+q,{headers:{Authorization:'Bearer '+c.streamlabsToken}});
   if(!r.ok)throw Error(r.status===401?'Streamlabsのトークンを更新してください。':'Streamlabsへの接続を再試行中です。');
   const batch=(await r.json()).data;if(!Array.isArray(batch))throw Error('Streamlabsの応答を確認できません。');data.push(...batch);
   if(previous===null||batch.length<100)break;
   before=Math.min(...batch.map(d=>Number(d.donation_id||d.id)));
   if(page===19)throw Error('寄付履歴が多いため同期を停止しました。履歴の確認が必要です。');
  }
  if(previous!==null){for(const d of [...data].reverse()){
   if(!d.donation_id&&!d.id)continue;
   await append(account,{id:'sl-'+(d.donation_id||d.id),source:'streamlabs',type:'donation',time:d.created_at||null,name:d.name||null,amount:d.amount??null,currency:d.currency||null,message:d.message||null});
  }}
  const cursor=data.reduce((max,d)=>Math.max(max,Number(d.donation_id||d.id)||0),Number(previous)||0);
  await set('sl-cursor:'+account,cursor,31536000);await set('sl-status:'+account,{ok:true});
 }catch(e){await set('sl-status:'+account,{ok:false,error:e.message});}
 return c;
}
