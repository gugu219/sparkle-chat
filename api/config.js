import {owner,sameOrigin,get} from '../lib/store.js';
import { json, redis, id } from '../lib/legacy.js';

/* A fixed OBS URL may be updated only by the owner who first issued it. */
const MAX = 300000;                       /* JSON characters */
const TTL = 60 * 60 * 24 * 365;           /* keep for a year */

export const config={runtime:'edge'};
export default async function(req){
  try{
    const u = new URL(req.url);if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed'},405);

    if(req.method === 'POST'){
      sameOrigin(req);const account=await owner(req);
      const body = await req.json().catch(() => null);
      const cfg = (body && body.config) || {};
      if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))return json({error:'設定の形式が正しくありません'},400);
      const profile=await get('profile:'+account);
      if(!profile?.overlay)return json({error:'Twitchに再接続してからURLを発行してください。'},401);
      cfg.overlay=profile.overlay;
      for(const name of ['chat','frame','alert','extras'])if(cfg[name]&&typeof cfg[name]==='object')cfg[name].overlay=profile.overlay;
      const data = JSON.stringify(cfg);if(/"(?:widget|accessToken|refreshToken|streamlabsToken|doneru|streamlabs)"\s*:/.test(data))return json({error:'秘密情報を設定URLに含めることはできません'},400);if(cfg.frame?.customImage?.startsWith('data:'))return json({error:'枠画像を先に保存してください'},400);
      if(data.length > MAX) return json({error:'設定が大きすぎます'}, 413);
      const requested=String(body.id||'');
      if(requested&&!/^[a-zA-Z0-9]{20}$/.test(requested))return json({error:'URLのIDが正しくありません'},400);
      if(requested){
        const holder=await redis().get(`cfg-owner:${requested}`);
        if(!holder||holder!==account)return json({error:'このOBS URLの設定は更新できません。新しい固定URLを発行してください。'},403);
      }
      const key=requested||id().slice(0,20);
      await redis().set(`cfg:${key}`, data, {ex: TTL});
      await redis().set(`cfg-owner:${key}`,account,{ex:TTL});
      return json({id: key});
    }

    const key = (u.searchParams.get('id') || '').replace(/[^a-zA-Z0-9]/g, '');
    if(!key) return json({error:'Missing id'}, 400);
    const data = await redis().get(`cfg:${key}`);
    if(!data) return json({error:'Not found'}, 404);
    return json(typeof data === 'string' ? JSON.parse(data) : data);
  }catch(e){ return json({error: e.message}, e.message?.includes('再接続')?401:500); }
};
