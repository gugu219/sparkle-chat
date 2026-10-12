// Keep the old Redis read-only while moving existing OBS links to the new free store.
const legacy=()=>({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN});
const usingNew=()=>!!(process.env.SPARKLE_NEW_KV_REST_API_URL&&process.env.SPARKLE_NEW_KV_REST_API_TOKEN);
const primary=()=>usingNew()?{url:process.env.SPARKLE_NEW_KV_REST_API_URL,token:process.env.SPARKLE_NEW_KV_REST_API_TOKEN}:legacy();
const migrateKey=key=>/^(?:owner|profile|overlay|twitch|twitch-user|integrations|calendar|calendar-owner|cfg|cfg-owner|img|snd|bot|stream|hype|sl-cursor|sl-status|connection-error|subscriptions|prism):/.test(key);
const migrationTtl=key=>/^(?:calendar|calendar-owner):/.test(key)?63072000:/^(?:cfg|cfg-owner|img|snd|profile|overlay|twitch-user|integrations|bot):/.test(key)?31536000:2592000;
const migrationMiss='__sparkle_migration_miss__';
async function request(store,args,attempts=2){
  const {url,token}=store;
  if(!url||!token)throw new Error('保存先が未設定です。Upstash環境変数を設定してください。');
  for(let attempt=0;attempt<attempts;attempt++){
    const response = await fetch(url, {method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify(args)});
    const result = await response.json().catch(()=>null);
    if(response.ok&&!result?.error){if(!result||!Object.hasOwn(result,'result'))throw new Error('保存先から正しい応答がありませんでした。');return result.result;}
    const reason=String(result?.error||'');
    const category=/max requests limit|daily|monthly|quota|request limit|command limit/i.test(reason)?'quota':/rate|second|concurrent|burst|too many/i.test(reason)?'throttle':/request size|single record size|key size/i.test(reason)?'request-size':/capacity|data size|storage/i.test(reason)?'storage':/limit|maximum|exceed/i.test(reason)?'limit':/token|auth|permission|forbidden|unauthorized/i.test(reason)?'credentials':/invalid|unknown|syntax|command|wrong/i.test(reason)?'command':'other';
    console.error('Redis REST request failed:',response.status,category);
    if(attempt<attempts-1&&['throttle','limit'].includes(category)){await new Promise(resolve=>setTimeout(resolve,400+Math.random()*300));continue;}
    throw new Error(`保存先との通信に失敗しました（HTTP ${response.status}）。`);
  }
}
export async function command(...args){
 const store=primary(),result=await request(store,args);
 if(result===migrationMiss)return null;
 if(!usingNew()||args[0]!=='GET'||result!==null||!migrateKey(String(args[1]||'')))return result;
 let old=null;try{old=await request(legacy(),args,1);}catch(error){console.error('Legacy Redis migration unavailable:',error.message);}
 if(old!==null){await request(store,['SET',args[1],old,'EX',migrationTtl(String(args[1]))]);return old;}
 await request(store,['SET',args[1],migrationMiss,'EX',300]);return null;
}
export const get = async key => { const value = await command('GET', key); if(value === null)return null; try{return JSON.parse(value);}catch{return value;} };
export const set = (key, value, ttl=2592000) => command('SET', key, JSON.stringify(value), 'EX', ttl);
export const remove = key => usingNew()&&migrateKey(key)?command('SET',key,JSON.stringify(null),'EX',migrationTtl(key)):command('DEL',key);
export const random = () => crypto.randomUUID().replaceAll('-','') + crypto.randomUUID().replaceAll('-','');
export const json = (value,status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export const base = () => {const u=new URL(process.env.APP_BASE_URL);if(u.protocol!=='https:')throw Error('APP_BASE_URLには本番HTTPS URLが必要です。');return u.origin;};
export function cookie(req,name){return (req.headers.get('cookie')||'').split(';').map(s=>s.trim().split('=')).find(x=>x[0]===name)?.[1]||'';}
export function sameOrigin(req){if(req.headers.get('origin')!==new URL(req.url).origin)throw Error('別サイトからの更新は許可されていません。');}
export async function owner(req){const key=cookie(req,'sparkle_owner');const account=key && await get('owner:'+key);if(!account)throw Error('Twitchに再接続してください。');return account;}
export const handle = fn => async req => {try{return await fn(req);}catch(e){return json({error:e.message||'処理に失敗しました。'},e.message?.includes('再接続')?401:503);}};
export async function body(req,max=300000){const text=await req.text();if(text.length>max)throw Error('データが大きすぎます。');return JSON.parse(text);}
export async function seal(value){
 const secret=process.env.APP_ENCRYPTION_KEY;if(!secret||secret.length<32)throw Error('APP_ENCRYPTION_KEYを32文字以上で設定してください。');
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value))));
 return {iv:Array.from(iv),data:Array.from(data)};
}
export async function unseal(value){
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(process.env.APP_ENCRYPTION_KEY||'')),'AES-GCM',false,['decrypt']);
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv)},key,new Uint8Array(value.data))));
}
