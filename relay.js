// A read-only overlay capability can receive render data, never OAuth credentials.
(() => {
 const qs=new URLSearchParams(location.search),id=qs.get('overlay');
 window.SparkleRelay={dispatch(payload){window.dispatchEvent(new CustomEvent('sparkle-events',{detail:payload}));}};
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.source!=='sparkle-relay')return;window.SparkleRelay.dispatch(e.data.payload);});
 // The combined editor preview must poll too: external widgets arrive with
 // the overlay response, while child frames marked managed still skip polling.
 if(!id||qs.has('managed'))return;
 const health=(ok,message,widgets)=>{window.dispatchEvent(new CustomEvent('sparkle-status',{detail:message}));if(qs.has('preview'))parent.postMessage({source:'sparkle-health',ok,message,widgets},location.origin);};
 let cursor=Date.now(),delay=2000;const seen=new Set();
 async function poll(){try{
  const r=await fetch('/api/overlay?id='+encodeURIComponent(id)+'&after='+cursor+(document.documentElement.dataset.page==='all'?'&widgets=1':''));const p=await r.json();if(!r.ok)throw Error(p.error||'接続エラー');
  p.events=(p.events||[]).filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;});if(seen.size>4000){const keep=[...seen].slice(-2000);seen.clear();keep.forEach(x=>seen.add(x));}
  cursor=p.now;delay=2000;window.SparkleRelay.dispatch(p);health(true,p.twitchStatus?.ok===false?'通知出力は接続中・Twitchは再認証が必要です':'通知出力に接続中',p.widgets?Object.fromEntries(Object.entries(p.widgets).map(([k,v])=>[k,!!v])):undefined);
 }catch(e){delay=Math.min(delay*2,30000);health(false,e.message+'（自動再試行します）');}setTimeout(poll,delay);}
 poll();
})();
