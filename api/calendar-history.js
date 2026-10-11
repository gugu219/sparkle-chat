import {historyFromCsv,fallbackHistory} from '../lib/calendar-history.js';
const source='https://docs.google.com/spreadsheets/d/1LRTFYia86AziVdnbDbaKwXMH_UxDWQBxawcSCC8oKgk/export?format=csv&gid=192951585';
let cached={entries:fallbackHistory,synced:false,updatedAt:0};
export async function GET(req){
 if(req.method!=='GET')return Response.json({error:'Method not allowed'},{status:405});
 if(Date.now()-cached.updatedAt>5*60*1000){
  try{
   const response=await fetch(source,{signal:AbortSignal.timeout(7000)});
   if(!response.ok)throw Error('Sheet unavailable');
   const csv=await response.text();
   if(csv.length>2_000_000)throw Error('Sheet too large');
   cached={entries:historyFromCsv(csv),synced:true,updatedAt:Date.now()};
  }catch{cached={...cached,updatedAt:Date.now()};}
 }
 return Response.json({entries:cached.entries,synced:cached.synced},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=240'}});
}
export default GET;
