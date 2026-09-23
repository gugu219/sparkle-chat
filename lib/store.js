// Redis REST keeps the server runtime small and works on Vercel's Web API runtime.
export async function command(...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('保存先が未設定です。Upstash環境変数を設定してください。');
  const response = await fetch(url, {method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify(args)});
  const result = await response.json();
  if (!response.ok || result.error) throw new Error('保存先との通信に失敗しました。');
  return result.result;
}
export const get = async key => { const value = await command('GET', key); if(value === null)return null; try{return JSON.parse(value);}catch{return value;} };
export const set = (key, value, ttl=2592000) => command('SET', key, JSON.stringify(value), 'EX', ttl);
export const remove = key => command('DEL',key);
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
