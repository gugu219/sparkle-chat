import { json, redis, id } from './_lib.js';

/* Stores a short alert sound and serves it back by id, so the OBS URL only
   has to carry the id (embedding the audio in the URL blows the length limit). */
const MAX = 900000;                       /* base64 characters (~650KB file) */
const TTL = 60 * 60 * 24 * 365;           /* keep for a year */

export default {async fetch(req){
  try{
    const u = new URL(req.url);

    if(req.method === 'POST'){
      const body = await req.json().catch(() => null);
      const data = String((body && body.data) || '');
      if(!/^data:audio\/[\w.+-]+;base64,/.test(data)) return json({error:'音声ファイルではありません'}, 400);
      if(data.length > MAX) return json({error:'ファイルが大きすぎます'}, 413);
      const key = id().slice(0, 22);
      await redis().set(`snd:${key}`, data, {ex: TTL});
      return json({id: key});
    }

    const key = (u.searchParams.get('id') || '').replace(/[^a-zA-Z0-9]/g, '');
    if(!key) return json({error:'Missing id'}, 400);
    const data = await redis().get(`snd:${key}`);
    if(!data) return json({error:'Not found'}, 404);
    const m = /^data:([\w./+-]+);base64,(.*)$/.exec(String(data));
    if(!m) return json({error:'Bad data'}, 500);
    const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    return new Response(bin, {headers:{
      'Content-Type': m[1],
      'Cache-Control': 'public, max-age=31536000, immutable'
    }});
  }catch(e){ return json({error: e.message}, 500); }
}};
