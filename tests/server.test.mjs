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
import {GET as calendarGet,POST as calendarPost} from '../api/calendar.js';
const calendarApi=req=>req.method==='GET'?calendarGet(req):calendarPost(req);
import eventApi from '../api/events.js';
import alertTestApi from '../api/alert-test.js';
import overlayLive from '../api/overlay-live.js';
import integrations from '../api/integrations.js';
import overlay from '../api/overlay.js';
import {validWidget} from '../api/integrations.js';
import {syncDonations} from '../lib/streamlabs.js';
import {cleanBotConfig,handleBotChat} from '../lib/bot.js';
import botApi from '../api/bot.js';
const originalFetch=globalThis.fetch;const db=new Map(),newDb=new Map(),z=new Map(),hash=new Map();let donations=[],botSends=[],redisFailures=0;
Object.assign(process.env,{UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'test',APP_ENCRYPTION_KEY:'test-only-encryption-key-32-characters',TWITCH_WEBHOOK_SECRET:'test-only-webhook-secret-32-characters',TWITCH_CLIENT_ID:'client',TWITCH_CLIENT_SECRET:'test',APP_BASE_URL:'https://sparkle.test'});
globalThis.fetch=async(url,options={})=>{
 if(String(url)==='https://api.twitch.tv/helix/chat/messages'){botSends.push(JSON.parse(options.body));return Response.json({data:[{message_id:'sent-'+botSends.length,is_sent:true}]});}
 if(String(url).startsWith('https://streamlabs.com/')){const q=new URL(url).searchParams;let rows=donations.filter(d=>(!q.get('after')||d.donation_id>+q.get('after'))&&(!q.get('before')||d.donation_id<+q.get('before')));return Response.json({data:rows.slice(0,100)});}
 if(!['https://redis.test','https://new-redis.test'].includes(String(url)))throw Error('Unexpected network access: '+url);
 const activeDb=String(url)==='https://new-redis.test'?newDb:db;
 const [cmd,key,...args]=JSON.parse(options.body);let result=null;
 if(key==='transient-key'&&redisFailures++===0)return Response.json({error:'rate limit exceeded'},{status:400});
 switch(cmd){
 case 'GET':result=activeDb.get(key)??null;break;
 case 'GETDEL':result=activeDb.get(key)??null;activeDb.delete(key);break;
 case 'SET':if(args.includes('NX')&&activeDb.has(key))break;activeDb.set(key,args[0]);result='OK';break;
 case 'DEL':activeDb.delete(key);result=1;break;
 case 'EXPIRE':result=1;break;
 case 'ZADD':if(!z.has(key))z.set(key,new Map());z.get(key).set(args[1],+args[0]);result=1;break;
 case 'ZREMRANGEBYSCORE':for(const [k,v]of z.get(key)||[])if(v<=+args[1])z.get(key).delete(k);result=0;break;
 case 'ZRANGEBYSCORE':result=[...(z.get(key)||[])].filter(([,v])=>v>=+args[0]).sort((a,b)=>a[1]-b[1]).slice(0,args[4]||200).map(([k])=>k);break;
 case 'ZREVRANGEBYSCORE':result=[...(z.get(key)||[])].filter(([,v])=>v>=+args[1]).sort((a,b)=>b[1]-a[1]).slice(0,300).map(([k])=>k);break;
 case 'MGET':result=[key,...args].map(k=>activeDb.get(k)??null);break;
 case 'HSET':if(!hash.has(key))hash.set(key,new Map());hash.get(key).set(args[0],args[1]);result=1;break;
 case 'HGETALL':result=[...(hash.get(key)||[])].flat();break;
 default:throw Error('Unknown Redis command '+cmd);
 }return Response.json({result});
};
beforeEach(()=>{db.clear();newDb.clear();z.clear();hash.clear();donations=[];botSends=[];redisFailures=0;delete process.env.SPARKLE_NEW_KV_REST_API_URL;delete process.env.SPARKLE_NEW_KV_REST_API_TOKEN;});after(()=>{globalThis.fetch=originalFetch;});
test('Redis retries a temporary limit response',async()=>{assert.equal(await get('transient-key'),null);assert.equal(redisFailures,2);});
test('OBS alert tests require the owner, reach only that overlay, and never enter the event log',async()=>{
 const overlayId='a'.repeat(64),otherId='b'.repeat(64);
 await set('owner:owner','account');await set('profile:account',{overlay:overlayId});
 assert.equal((await alertTestApi(request('/api/alert-test','POST',{event:'gift',num:10}))).status,401);
 assert.equal((await alertTestApi(request('/api/alert-test','POST',{event:'unknown'},true))).status,400);
 const sent=await alertTestApi(request('/api/alert-test','POST',{event:'gift',num:10,detail:'×10'},true));
 assert.equal(sent.status,200);
 const packet=(await (await alertTestApi(request('/api/alert-test?overlay='+overlayId))).json()).event;
 assert.equal(packet.event,'gift');assert.equal(packet.num,10);assert.equal(packet.detail,'×10');
 assert.equal((await (await alertTestApi(request('/api/alert-test?overlay='+otherId))).json()).event,null);
 assert.deepEqual(await recent('account'),[]);
 await alertTestApi(request('/api/alert-test','POST',{event:'hype'},true));
 assert.equal((await (await alertTestApi(request('/api/alert-test?overlay='+overlayId))).json()).event.event,'hype');
});
test('uncached OBS notification path delivers new events and tests without exposing another overlay',async()=>{
 const overlayId='c'.repeat(64);
 assert.equal((await overlayLive(request('/api/overlay-live?overlay=bad'))).status,400);
 assert.equal((await overlayLive(request('/api/overlay-live?overlay='+overlayId))).status,404);
 await set('overlay:'+overlayId,'account');
 await append('account',{id:'live-event',type:'gift',name:'Mika'});
 await set('obs-test:'+overlayId,{id:'test-event',event:'bits',sentAt:Date.now()});
 const response=await overlayLive(request('/api/overlay-live?overlay='+overlayId+'&after='+(Date.now()-1000)));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.deepEqual(data.events.map(event=>event.id),['live-event']);
 assert.equal(data.test.event,'bits');
 assert.equal(typeof data.now,'number');
});
test('old calendar and frame records move to the new store without changing their keys',async()=>{
 await set('calendar:old-id',{entries:{'2026-10-12':{text:'配信'}}});await set('img:old-image','data:image/png;base64,AAAA');
 process.env.SPARKLE_NEW_KV_REST_API_URL='https://new-redis.test';process.env.SPARKLE_NEW_KV_REST_API_TOKEN='new-test-token';
 assert.equal((await get('calendar:old-id')).entries['2026-10-12'].text,'配信');assert.equal(await get('img:old-image'),'data:image/png;base64,AAAA');
 db.clear();assert.equal((await get('calendar:old-id')).entries['2026-10-12'].text,'配信');assert.equal(await get('img:old-image'),'data:image/png;base64,AAAA');
});
const request=(path,method='GET',value,authenticated=false)=>new Request('https://sparkle.test'+path,{method,headers:{origin:'https://sparkle.test',...(authenticated?{cookie:'sparkle_owner=owner'}:{})},...(!['GET','HEAD'].includes(method)?{body:JSON.stringify(value)}:{})});
test('calendar issues a separate public OBS link and only its owner can update it',async()=>{
 await set('owner:owner','account');
 assert.equal((await calendarApi(request('/api/calendar','POST',{entries:{}}))).status,401);
 const created=await calendarApi(request('/api/calendar','POST',{entries:{'2026-10-12':{kind:'game',text:'テスト配信',startHour:'21'}}},true));
 assert.equal(created.status,200);const {id}=await created.json();
 assert.equal((await calendarApi(request('/api/calendar?mine=1'))).status,401);
 assert.equal((await (await calendarApi(request('/api/calendar?mine=1','GET',null,true))).json()).id,id);
 const read=await (await calendarApi(request('/api/calendar?id='+id))).json();
 assert.equal(read.entries['2026-10-12'].text,'テスト配信');assert.equal(read.entries['2026-10-12'].startHour,'21');assert.equal(read.owner,undefined);
 await set('owner:owner','other');
 assert.equal((await calendarApi(request('/api/calendar','POST',{id,entries:{}},true))).status,403);
 assert.equal((await calendarApi(request('/api/calendar','POST',{entries:{'2026-02-30':{kind:'rest'}}},true))).status,400);
 assert.equal((await calendarApi(request('/api/calendar','POST',{entries:{'2026-10-13':{kind:'game',startHour:'24'}}},true))).status,400);
 await set('owner:owner','account');
 const edited=await calendarApi(request('/api/calendar','POST',{id,entries:{'2026-10-01':{kind:'chat',text:'配信後に修正',startHour:'',overrideHistory:true}}},true));
 assert.equal(edited.status,200);
 assert.equal((await (await calendarApi(request('/api/calendar?id='+id))).json()).entries['2026-10-01'].overrideHistory,true);
 const automatic=await calendarApi(request('/api/calendar','POST',{entries:{'2026-10-14':{kind:'game',text:'変更した予定'}}},true));
 assert.equal((await automatic.json()).id,id);
 assert.equal((await (await calendarApi(request('/api/calendar?id='+id))).json()).entries['2026-10-14'].text,'変更した予定');
 assert.equal((await calendarApi(request('/api/calendar','POST',{entries:{'2026-10-01':{overrideHistory:'true'}}},true))).status,400);
});
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
test('bot validates simple commands and rejects duplicates',()=>{
 assert.deepEqual(cleanBotConfig({enabled:true,commands:[{name:'!Discord',response:'Join us'}],promos:['Follow us'],interval:30}).commands,[{name:'discord',response:'Join us'}]);
 assert.throws(()=>cleanBotConfig({commands:[{name:'!discord',response:'x'},{name:'discord',response:'y'}],promos:[]}));
});
test('only the connected broadcaster can save and read bot rules',async()=>{
 const config={enabled:false,commands:[{name:'!discord',response:'Discord link'}],promos:[],interval:30};
 assert.equal((await botApi(request('/api/bot'))).status,401);
 await set('owner:owner','account');
 assert.equal((await botApi(request('/api/bot','POST',config,true))).status,200);
 const data=await (await botApi(request('/api/bot','GET',null,true))).json();
 assert.equal(data.config.commands[0].name,'discord');
 assert.equal((await botApi(request('/api/bot','POST',{...config,commands:[{name:'!discord',response:''}]},true))).status,400);
});
test('bot replies once and posts promotions only after live interval',async()=>{
 await set('twitch:account',await seal({userId:'123',accessToken:'private',refreshToken:'private',expiresAt:Date.now()+3600000,validatedAt:Date.now()}));
 await set('bot:account',{enabled:true,commands:[{name:'discord',response:'Discord link'}],promos:['X link','Discord promo'],interval:30});
 const commandEvent={chatter_user_id:'456',message_id:'msg1',message:{text:'!discord'}};
 assert.equal(await handleBotChat('account',commandEvent,'event1'),true);
 assert.equal(await handleBotChat('account',commandEvent,'event1'),false);
 assert.equal(botSends.length,1);assert.equal(botSends[0].reply_parent_message_id,'msg1');
 await set('stream:account',{id:'live1',live:true,time:new Date(Date.now()-31*60000).toISOString()});
 assert.equal(await handleBotChat('account',{chatter_user_id:'456',message:{text:'hello'}},'event2'),true);
 assert.equal(await handleBotChat('account',{chatter_user_id:'789',message:{text:'hello'}},'event3'),false);
 assert.equal(botSends.length,2);assert.equal(botSends[1].message,'X link');
 await set('stream:account',{id:'live1',live:true,time:new Date(Date.now()-61*60000).toISOString()});
 assert.equal(await handleBotChat('account',{chatter_user_id:'789',message:{text:'another hello'}},'event4'),true);
 assert.equal(botSends[2].message,'Discord promo');
});
test('Twitch follow notifications display once without entering the private record',async()=>{await set('twitch-user:123','account');const p={subscription:{type:'channel.follow',condition:{broadcaster_user_id:'123'}},event:{user_name:'Mika',user_id:'456'}};await hook(await signed(p));await hook(await signed(p));assert.equal((await events('account')).length,1);assert.deepEqual(await recent('account'),[]);assert.equal((await eventApi(request('/api/events'))).status,401);});
test('only real watch streaks enter the 30-day record',async()=>{
 await set('owner:owner','account');
 await append('account',{id:'gift-1',source:'twitch',type:'gift',name:'Mika'});
 await append('account',{id:'streak-1',source:'twitch',type:'streak',name:'Mika',count:12});
 assert.deepEqual((await events('account')).map(e=>e.type),['gift','streak']);
 assert.deepEqual((await recent('account')).map(e=>e.type),['streak']);
 assert.equal((await (await eventApi(request('/api/events','GET',null,true))).json()).events.length,1);
 await append('account',{id:'streak-sample',source:'twitch',type:'streak',test:true,name:'Preview',count:12});
 assert.equal((await recent('account')).length,1);
 await eventApi(request('/api/events','POST',{action:'test',source:'twitch'},true));
 assert.equal((await recent('account')).length,1);
});
test('stream offline clears render badges without altering previous stream data',async()=>{await set('twitch-user:123','account');await set('stream:account',{id:'stream1',live:true,time:new Date(Date.now()-1000).toISOString()});const payload={subscription:{type:'stream.offline',condition:{broadcaster_user_id:'123'}},event:{}};await hook(await signed(payload));assert.equal((await get('stream:account')).live,false);});
test('Streamlabs first sync ignores history then displays donations without recording them',async()=>{await set('integrations:account',await seal({mode:'api',streamlabsToken:'private'}));donations=[{donation_id:1,name:'Old',amount:'1'}];await syncDonations('account');assert.equal((await events('account')).length,0);db.delete('sl-poll:account');donations=Array.from({length:151},(_,i)=>({donation_id:151-i,name:'Mika',amount:'10',currency:'JPY'}));await syncDonations('account');assert.equal((await events('account')).length,150);assert.deepEqual(await recent('account'),[]);db.delete('sl-poll:account');await syncDonations('account');assert.equal((await events('account')).length,150);});

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
 let r=await (await integrations(request('/api/integrations','GET',null,true))).json();assert.equal(r.doneru,true);assert.equal(r.streamlabs,true);assert.equal(r.doneruUrl,'https://doneru.jp/widget/private');assert.equal(r.streamlabsUrl,'https://streamlabs.com/widgets/alert-box/private');assert.equal(r.streamlabsToken,undefined);
 assert.equal((await integrations(request('/api/integrations'))).status,401);
 await integrations(request('/api/integrations','POST',{doneru:'',mode:'widget'},true));r=await (await integrations(request('/api/integrations','GET',null,true))).json();assert.equal(r.doneru,false);assert.equal(r.doneruUrl,'');assert.equal(r.streamlabs,true);
});
test('authenticated editor retains overlay access when Twitch needs reauthentication',async()=>{
 await set('owner:owner','account');await set('profile:account',{overlay:'read-only'});
 const r=await session(request('/api/auth/session','GET',null,true));assert.equal(r.status,200);const data=await r.json();assert.equal(data.overlay,'read-only');assert.match(data.error,/再認証/);
});
test('fixed OBS URL updates in place only for its owner',async()=>{
 await set('owner:owner','account');await set('profile:account',{overlay:'a'.repeat(64)});
 const created=await configApi(request('/api/config','POST',{config:{frame:{cameraOn:'0'}}},true));
 const {id}=await created.json();assert.equal(id.length,20);
 const changed=await configApi(request('/api/config','POST',{id,config:{frame:{cameraOn:'1',cameraRatio:'9:16'}}},true));
 assert.equal(changed.status,200);assert.equal((await changed.json()).id,id);
 const live=await (await configApi(request('/api/config?id='+id))).json();assert.equal(live.frame.cameraRatio,'9:16');
 await set('owner:owner','other');await set('profile:other',{overlay:'b'.repeat(64)});
 assert.equal((await configApi(request('/api/config','POST',{id,config:{frame:{cameraOn:'0'}}},true))).status,403);
 assert.equal((await (await configApi(request('/api/config?id='+id))).json()).frame.cameraOn,'1');
});
test('portrait OBS config gets a separate URL and keeps its canvas layout',async()=>{
 await set('owner:owner','account');await set('profile:account',{overlay:'a'.repeat(64)});
 const landscape=await configApi(request('/api/config','POST',{config:{layout:'landscape',frame:{cameraOn:'0'}}},true));
 const portrait=await configApi(request('/api/config','POST',{config:{layout:'portrait',frame:{cameraOn:'1',cameraRatio:'9:16',cameraX:'300',cameraY:'1060'},chat:{posX:'220',posY:'1280'},alert:{pos:'tc',offsetX:'120',offsetY:'460'}}},true));
 assert.equal(landscape.status,200);assert.equal(portrait.status,200);
 const landId=(await landscape.json()).id,portraitId=(await portrait.json()).id;
 assert.notEqual(landId,portraitId);
 const saved=await (await configApi(request('/api/config?id='+portraitId))).json();
 assert.equal(saved.layout,'portrait');assert.equal(saved.frame.cameraRatio,'9:16');
 assert.equal(saved.chat.posX,'220');assert.equal(saved.chat.posY,'1280');
 assert.equal(saved.alert.offsetX,'120');assert.equal(saved.alert.offsetY,'460');
 assert.equal((await (await configApi(request('/api/config?id='+landId))).json()).frame.cameraOn,'0');
});
test('unreadable old integration settings can be replaced with new URLs',async()=>{
 await set('owner:owner','account');await set('integrations:account',{iv:[],data:[]});
 assert.equal((await integrations(request('/api/integrations','GET',null,true))).status,409);
 const empty=await integrations(request('/api/integrations','POST',{mode:'widget'},true));assert.equal(empty.status,409);
 const response=await integrations(request('/api/integrations','POST',{doneru:'https://doneru.jp/widget/new',mode:'widget'},true));assert.equal(response.status,200);assert.equal((await response.json()).replacedUnreadable,true);
 const saved=await (await integrations(request('/api/integrations','GET',null,true))).json();assert.equal(saved.doneruUrl,'https://doneru.jp/widget/new');
});
