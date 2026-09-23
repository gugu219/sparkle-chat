// A read-only overlay capability can receive render data, never OAuth credentials.
(() => {
 const qs=new URLSearchParams(location.search),id=qs.get('overlay');
 window.SparkleRelay={dispatch(payload){window.dispatchEvent(new CustomEvent('sparkle-events',{detail:payload}));}};
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.source!=='sparkle-relay')return;window.SparkleRelay.dispatch(e.data.payload);});
 if(!id||qs.has('managed')||qs.has('preview'))return;
 let cursor=Date.now(),delay=2000;const seen=new Set();
 async function poll(){try{
  const r=await fetch('/api/overlay?id='+encodeURIComponent(id)+'&after='+cursor+(document.documentElement.dataset.page==='all'?'&widgets=1':''));const p=await r.json();if(!r.ok)throw Error(p.error||'接続エラー');
  p.events=(p.events||[]).filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;});if(seen.size>4000){const keep=[...seen].slice(-2000);seen.clear();keep.forEach(x=>seen.add(x));}
  cursor=p.now;delay=2000;window.SparkleRelay.dispatch(p);
 }catch(e){delay=Math.min(delay*2,30000);window.dispatchEvent(new CustomEvent('sparkle-status',{detail:e.message}));}setTimeout(poll,delay);}
 poll();
})();
