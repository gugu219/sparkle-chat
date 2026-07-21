import { Redis } from '@upstash/redis';
export const base=()=>process.env.APP_BASE_URL.replace(/\/$/,'');
export const redis=()=>Redis.fromEnv();
export const id=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
export const json=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function token(form){const r=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form)});const x=await r.json();if(!r.ok)throw new Error(x.message||'Twitch token error');return x;}
export async function load(widget){return (await redis().get(`prism:${widget}`))||null;}
export async function save(widget,value){return redis().set(`prism:${widget}`,value,{ex:2592000});}
