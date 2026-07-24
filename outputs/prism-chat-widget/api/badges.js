import { json, redis, token } from './_lib.js';

const H=tok=>({'Client-Id':process.env.TWITCH_CLIENT_ID,'Authorization':`Bearer ${tok}`});

// App access token (client credentials) — no user login required. Cached in Redis.
async function appToken(){
  const r=redis();
  try{const c=await r.get('prism:apptoken');if(c)return c;}catch{}
  const t=await token({client_id:process.env.TWITCH_CLIENT_ID,client_secret:process.env.TWITCH_CLIENT_SECRET,grant_type:'client_credentials'});
  try{await r.set('prism:apptoken',t.access_token,{ex:Math.max(600,(t.expires_in||3600)-3600)});}catch{}
  return t.access_token;
}

// Flatten Helix badge sets into { "set_id/version_id": image_url }
function flatten(data,map){for(const set of data||[])for(const v of set.versions||[])map[`${set.set_id}/${v.id}`]=v.image_url_2x||v.image_url_1x||v.image_url_4x;}

export default {async fetch(req){
  try{
    const u=new URL(req.url),channel=(u.searchParams.get('channel')||'').trim().toLowerCase();
    const key=channel?`prism:badges:${channel}`:'prism:badges:_global';
    const r=redis();
    try{const c=await r.get(key);if(c)return json(c);}catch{}

    const tok=await appToken();
    const map={};
    const g=await fetch('https://api.twitch.tv/helix/chat/badges/global',{headers:H(tok)});
    if(g.ok)flatten((await g.json()).data,map);
    if(channel){
      const us=await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`,{headers:H(tok)});
      const uid=us.ok?(await us.json()).data?.[0]?.id:null;
      if(uid){
        const cb=await fetch(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${uid}`,{headers:H(tok)});
        if(cb.ok)flatten((await cb.json()).data,map); // channel badges override globals of same key
      }
    }
    try{await r.set(key,map,{ex:3600});}catch{}
    return json(map);
  }catch(e){return json({error:e.message},500);}
}};
