import {handle,json,owner,get,set,remove,sameOrigin,body,seal,unseal} from '../lib/store.js';
export const config={runtime:'edge'};
export function validWidget(value,provider){if(!value)return '';const u=new URL(value);const hosts=provider==='doneru'?['doneru.jp','www.doneru.jp']:['streamlabs.com','www.streamlabs.com'];if(u.protocol!=='https:'||!hosts.includes(u.hostname)||u.username||u.password||u.port)throw Error('公式サービスのHTTPS Widget URLを入力してください。');return u.href;}
export default handle(async req=>{
 const account=await owner(req),stored=await get('integrations:'+account);let data={},unreadable=false;
 if(stored)try{data=await unseal(stored);}catch{unreadable=true;}
 if(unreadable&&req.method==='GET')return json({error:'以前の保存設定を読み出せません。通知URLを入力し直して保存してください。'},409);
 if(req.method==='GET')return json({doneru:!!data.doneru,streamlabs:!!data.streamlabs,doneruUrl:data.doneru||'',streamlabsUrl:data.streamlabs||'',streamlabsApi:!!data.streamlabsToken,mode:data.mode||'widget'});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);sameOrigin(req);const b=await body(req,16000);
 if(unreadable&&!b.doneru&&!b.streamlabs&&!b.streamlabsToken)return json({error:'通知URLを入力し直して保存してください。'},409);
 for(const k of ['doneru','streamlabs']){if(b[k]!==undefined)data[k]=validWidget(b[k],k);}
 if(b.streamlabsToken!==undefined){data.streamlabsToken=String(b.streamlabsToken).trim();if(b.resetHistory)await remove('sl-cursor:'+account);}
 data.mode=b.mode==='api'?'api':'widget';
 if(data.mode==='api'&&!data.streamlabsToken)throw Error('Streamlabsのdonations.readアクセストークンが必要です。');
 await set('integrations:'+account,await seal(data),31536000);return json({ok:true,replacedUnreadable:unreadable});
});
