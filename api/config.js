import { json, redis, id } from './_lib.js';

/* Stores a combined overlay config (chat + frame + alert + extras settings) and
   serves it back by id, so one OBS browser source can carry all four via a short URL. */
const MAX = 300000;                       /* JSON characters */
const TTL = 60 * 60 * 24 * 365;           /* keep for a year */

export default {async fetch(req){
  try{
    const u = new URL(req.url);

    if(req.method === 'POST'){
      const body = await req.json().catch(() => null);
      const cfg = (body && body.config) || {};
      const data = JSON.stringify(cfg);
      if(data.length > MAX) return json({error:'設定が大きすぎます'}, 413);
      const key = id().slice(0, 20);
      await redis().set(`cfg:${key}`, data, {ex: TTL});
      return json({id: key});
    }

    const key = (u.searchParams.get('id') || '').replace(/[^a-zA-Z0-9]/g, '');
    if(!key) return json({error:'Missing id'}, 400);
    const data = await redis().get(`cfg:${key}`);
    if(!data) return json({error:'Not found'}, 404);
    return json(typeof data === 'string' ? JSON.parse(data) : data);
  }catch(e){ return json({error: e.message}, 500); }
}};
