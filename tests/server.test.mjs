import {test,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {set,get,seal,unseal} from '../lib/store.js';
import {normalizeTwitch,events,recent,append} from '../lib/events.js';
import hook from '../api/twitch-hook.js';
import session from '../api/auth/session.js';
import login from '../api/auth/login.js';
import callback from '../api/auth/callback.js';
import image from '../api/image.js';
import configApi from '../api/config.js';
import eventApi from '../api/events.js';
import integrations from '../api/integrations.js';
import overlay from '../api/overlay.js';
import {validWidget} from '../api/integrations.js';
import {syncDonations} from '../lib/streamlabs.js';
const originalFetch=globalThis.fetch;const db=new Map(),z=new Map(),hash=new Map();let donations=[];
Object.assign(process.env,{UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'test',APP_ENCRYPTION_KEY:'test-only-encryption-key-32-characters',TWITCH_WEBHOOK_SECRET:'test-only-webhook-secret-32-characters',TWITCH_CLIENT_ID:'client',TWITCH_CLIENT_SECRET:'test',APP_BASE_URL:'https://sparkle.test'});
globalThis.fetch=async(url,options={})=>{
 if(String(url).startsWith('https://streamlabs.com/')){const q=new URL(url).searchParams;let rows=donations.filter(d=>(!q.get('after')||d.donation_id>+q.get('after'))&&(!q.get('before')||d.donation_id<+q.get('before')));return Response.json({data:rows.slice(0,100)});}
 if(String(url)!=='https://redis.test')throw Error('Unexpected network access: '+url);
 const [cmd,key,...args]=JSON.parse(options.body);let result=null;
 switch(cmd){
 case 'GET':result=db.get(key)??null;break;
 case 'GETDEL':result=db.get(key)??null;db.delete(key);break;
 case 'SET':if(args.includes('NX')&&db.has(key))break;db.set(key,args[0]);result='OK';break;
 case 'DEL':db.delete(key);result=1;break;
 case 'EXPIRE':result=1;break;
 case 'ZADD':if(!z.has(key))z.set(key,new Map());z.get(key).set(args[1],+args[0]);result=1;break;
 case 'ZREMRANGEBYSCORE':for(const [k,v]of z.get(key)||[])if(v<=+args[1])z.get(key).delete(k);result=0;break;
 case 'ZRANGEBYSCORE':result=[...(z.get(key)||[])].filter(([,v])=>v>=+args[0]).sort((a,b)=>a[1]-b[1]).slice(0,args[4]||200).map(([k])=>k);break;
 case 'ZREVRANGEBYSCORE':result=[...(z.get(key)||[])].filter(([,v])=>v>=+args[1]).sort((a,b)=>b[1]-a[1]).slice(0,300).map(([k])=>k);break;
 case 'MGET':result=[key,...args].map(k=>db.get(k)??null);break;
 case 'HSET':if(!hash.has(key))hash.set(key,new Map());hash.get(key).set(args[0],args[1]);result=1;break;
 case 'HGETALL':result=[...(hash.get(key)||[])].flat();break;
 default:throw Error('Unknown Redis command '+cmd);
 }return Response.json({result});
};
beforeEach(()=>{db.clear();z.clear();hash.clear();donations=[];});after(()=>{globalThis.fetch=originalFetch;});
const request=(path,method='GET',value,authenticated=false)=>new Request('https://sparkle.test'+path,{method,headers:{origin:'https://sparkle.test',...(authenticated?{cookie:'sparkle_owner=owner'}:{})},...(!['GET','HEAD'].includes(method)?{body:JSON.stringify(value)}:{})});
test('encrypted secrets round-trip and reject modified ciphertext',async()=>{const encrypted=await seal({token:'private'});assert.equal(JSON.stringify(encrypted).includes('private'),false);assert.deepEqual(await unseal(encrypted),{token:'private'});encrypted.data[0]^=1;await assert.rejects(()=>unseal(encrypted));});
test('OAuth status requires owner cookie even with legacy widget id',async()=>{const r=await session(request('/api/auth/session?widget=old-secret'));assert.equal(r.status,401);assert.equal((await r.text()).includes('accessToken'),false);});
test('OAuth status does not expose access or refresh tokens',async()=>{await set('owner:owner','account');await set('profile:account',{overlay:'read-only'});await set('twitch:account',await seal({login:'mika',userId:'123',accessToken:'PRIVATE_ACCESS',refreshToken:'PRIVATE_REFRESH',expiresAt:Date.now()+3600000,validatedAt:Date.now()}));const r=await session(request('/api/auth/session','GET',null,true));const text=await r.text();assert.equal(r.status,200);assert.equal(text.includes('PRIVATE'),false);assert.equal(JSON.parse(text).overlay,'read-only');});
test('OAuth login uses exact canonical callback and one-time state',async()=>{const r=await login(request('/api/auth/login'));assert.equal(r.status,302);const u=new URL(r.headers.get('location'));assert.equal(u.searchParams.get('redirect_uri'),'https://sparkle.test/api/auth/callback');assert.ok(u.searchParams.get('scope').includes('channel:read:hype_train'));assert.ok(await get('oauth-state:'+u.searchParams.get('state')));const bad=await callback(request('/api/auth/callback?code=bad&state=forged'));assert.equal(bad.status,403);});
test('upload and config writes reject anonymous callers',async()=>{assert.equal((await image(request('/api/image','POST',{data:'data:image/png;base64,AAAA'}))).status,401);assert.equal((await configApi(request('/api/config','POST',{config:{}}))).status,401);});
test('config rejects credentials and unsaved local frames',async()=>{await set('owner:owner','account');await set('profile:account',{overlay:'a'.repeat(64)});for(const cfg of [{alert:{widget:'old-token'}},{frame:{customImage:'data:image/png;base64,AA'}}])assert.equal((await configApi(request('/api/config','POST',{config:cfg},true))).status,400);});
test('official widget URL allowlist rejects lookalikes and javascript',()=>{assert.equal(validWidget('https://doneru.jp/widget/test','doneru'),'https://doneru.jp/widget/test');for(const url of ['javascript:alert(1)','https://doneru.jp.attacker.test/widget','https://user:password@doneru.jp/'])assert.throws(()=>validWidget(url,'doneru'));});
test('normalizer uses stable Twitch IDs and ignores bulk gift children',()=>{const e=normalizeTwitch('channel.chat.notification',{notice_type:'watch_streak',chatter_user_id:'12',chatter_user_name:'Mika',watch_streak:{streak_count:12}},'evt','now');assert.equal(e.userId,'12');assert.equal(e.count,12);assert.equal(normalizeTwitch('channel.chat.notification',{notice_type:'sub_gift',sub_gift:{community_gift_id:'bulk'}},'evt','now'),null);});
async function signed(payload,id='message',time=new Date().toISOString(),signatureOverride){const text=JSON.stringify(payload);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(process.env.TWITCH_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+time+text)));return new Request('https://sparkle.test/api/twitch-hook',{method:'POST',headers:{'Twitch-Eventsub-Message-Id':id,'Twitch-Eventsub-Message-Timestamp':time,'Twitch-Eventsub-Message-Signature':signatureOverride||'sha256='+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(''),'Twitch-Eventsub-Message-Type':payload.challenge?'webhook_callback_verification':'notification'},body:text});}
test('webhook validates signature and freshness before accepting challenge',async()=>{assert.equal(await (await hook(await signed({challenge:'verify'}))).text(),'verify');assert.equal((await hook(await signed({challenge:'bad'},'x',new Date().toISOString(),'sha256='+'0'.repeat(64)))).status,403);assert.equal((await hook(await signed({challenge:'old'},'x',new Date(Date.now()-700000).toISOString()))).status,403);});
test('Twitch duplicate notifications create exactly one private log entry',async()=>{await set('twitch-user:123','account');const p={subscription:{type:'channel.follow',condition:{broadcaster_user_id:'123'}},event:{user_name:'Mika',user_id:'456'}};await hook(await signed(p));await hook(await signed(p));assert.equal((await recent('account')).length,1);assert.equal((await eventApi(request('/api/events'))).status,401);});
test('stream offline clears render badges without altering previous stream data',async()=>{await set('twitch-user:123','account');await set('stream:account',{id:'stream1',live:true,time:new Date(Date.now()-1000).toISOString()});const payload={subscription:{type:'stream.offline',condition:{broadcaster_user_id:'123'}},event:{}};await hook(await signed(payload));assert.equal((await get('stream:account')).live,false);});
test('Streamlabs first sync ignores history then recovers more than one page without duplicates',async()=>{await set('integrations:account',await seal({mode:'api',streamlabsToken:'private'}));donations=[{donation_id:1,name:'Old',amount:'1'}];await syncDonations('account');assert.equal((await recent('account')).length,0);db.delete('sl-poll:account');donations=Array.from({length:151},(_,i)=>({donation_id:151-i,name:'Mika',amount:'10',currency:'JPY'}));await syncDonations('account');assert.equal((await recent('account')).length,150);db.delete('sl-poll:account');await syncDonations('account');assert.equal((await recent('account')).length,150);});

test('saved OBS config binds to owner even if browser sends no or another overlay',async()=>{
 await set('owner:owner','account');await set('profile:account',{overlay:'a'.repeat(64)});
 const r=await configApi(request('/api/config','POST',{config:{overlay:'foreign',chat:{overlay:'foreign'},frame:{}}},true));assert.equal(r.status,200);
 const {id}=await r.json();const stored=await (await configApi(request('/api/config?id='+id))).json();assert.equal(stored.overlay,'a'.repeat(64));assert.equal(stored.chat.overlay,stored.overlay);
});
test('external widgets remain available when Twitch credentials expire',async()=>{
 const key='b'.repeat(64);await set('overlay:'+key,'account');await set('integrations:account',await seal({doneru:'https://doneru.jp/widget/private',mode:'widget'}));
 const r=await overlay(request('/api/overlay?id='+key+'&widgets=1'));assert.equal(r.status,200);const data=await r.json();assert.equal(data.widgets.doneru,'https://doneru.jp/widget/private');assert.equal(data.twitchStatus.ok,false);
 const plain=await (await overlay(request('/api/overlay?id='+key))).json();assert.equal(plain.widgets,undefined);
});
test('widget settings persist across partial saves and can be removed without disclosure',async()=>{
 await set('owner:owner','account');await integrations(request('/api/integrations','POST',{doneru:'https://doneru.jp/widget/private',mode:'widget'},true));
 await integrations(request('/api/integrations','POST',{streamlabs:'https://streamlabs.com/widgets/alert-box/private',mode:'widget'},true));
 let r=await (await integrations(request('/api/integrations','GET',null,true))).json();assert.equal(r.doneru,true);assert.equal(r.streamlabs,true);assert.equal(JSON.stringify(r).includes('private'),false);
 await integrations(request('/api/integrations','POST',{doneru:'',mode:'widget'},true));r=await (await integrations(request('/api/integrations','GET',null,true))).json();assert.equal(r.doneru,false);assert.equal(r.streamlabs,true);
});
test('authenticated editor retains overlay access when Twitch needs reauthentication',async()=>{
 await set('owner:owner','account');await set('profile:account',{overlay:'read-only'});
 const r=await session(request('/api/auth/session','GET',null,true));assert.equal(r.status,200);const data=await r.json();assert.equal(data.overlay,'read-only');assert.match(data.error,/再認証/);
});
