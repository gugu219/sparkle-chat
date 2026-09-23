(async()=>{
 const qs=new URLSearchParams(location.search);let cfg={};
 try{if(qs.has('id')){const r=await fetch('/api/config?id='+encodeURIComponent(qs.get('id')));if(!r.ok)throw Error('設定を読み込めません');cfg=await r.json();}else if(qs.has('c'))cfg=JSON.parse(qs.get('c'));}catch(e){document.body.textContent=e.message;return;}
 if(qs.has('preview'))cfg=await new Promise(resolve=>{window.addEventListener('message',function receive(e){if(e.origin!==location.origin||e.source!==parent||e.data?.source!=='prism-editor'||e.data.type!=='all-config')return;window.removeEventListener('message',receive);resolve(e.data.config);});parent.postMessage({source:'sparkle-all-ready'},location.origin);});
 const frames=new Map(),order=['frame','extras','chat','alert'],files={frame:'frame.html',extras:'extras.html',chat:'view.html',alert:'alert.html'};
 // Start the relay after resolving config, so a short OBS URL remains sufficient.
 if(cfg.overlay)qs.set('overlay',cfg.overlay);history.replaceState(null,'',location.pathname+'?'+qs);
 for(const name of order){if(!cfg[name])continue;const params=new URLSearchParams(cfg[name]);if(params.get('customImage')?.startsWith('data:'))params.delete('customImage');params.delete('widget');if(cfg.channel&&name!=='extras')params.set('channel',cfg.channel);if(cfg.overlay)params.set('overlay',cfg.overlay);params.set('managed','1');if(qs.has('preview'))params.set('preview','1');
 const f=document.createElement('iframe');f.className='ov';f.title=name;f.style.zIndex=String(name==='frame'&&cfg.frame.customLayer==='front'?4:order.indexOf(name)+1);if(name==='alert')f.style.zIndex='6';f.src=files[name]+'?'+params;document.body.append(f);frames.set(name,f);f._pending=[];f._ready=false;
 }
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.source==='sparkle-frame-ready'&&e.source===frames.get('frame')?.contentWindow)e.source.postMessage({source:'prism-editor',type:'frame-settings',settings:cfg.frame},location.origin);});
 let latest=null;
 function relay(p){latest=p;for(const frame of frames.values()){if(!frame._ready){frame._pending.push(...p.events||[]);continue;}frame.contentWindow?.postMessage({source:'sparkle-relay',payload:p},location.origin);}if(p.widgets)for(const [name,url]of Object.entries(p.widgets)){
  let f=document.querySelector('[data-widget="'+name+'"]');if(!url){f?.remove();continue;}let u;try{u=new URL(url);}catch{continue;}if(u.protocol!=='https:'||!['doneru.jp','www.doneru.jp','streamlabs.com','www.streamlabs.com'].includes(u.hostname))continue;
  if(!f){f=document.createElement('iframe');f.className='ov';f.dataset.widget=name;f.title=name+' alerts';f.style.zIndex='5';f.allow='autoplay';f.referrerPolicy='no-referrer';f.setAttribute('sandbox','allow-scripts allow-same-origin');document.body.append(f);}if(f.src!==url)f.src=url;
 }}
 for(const frame of frames.values())frame.addEventListener('load',()=>{frame._ready=true;if(frame.title==='frame')frame.contentWindow.postMessage({source:'prism-editor',type:'frame-settings',settings:cfg.frame},location.origin);if(latest)frame.contentWindow.postMessage({source:'sparkle-relay',payload:{...latest,events:frame._pending}},location.origin);frame._pending=[];});
 window.addEventListener('sparkle-events',e=>relay(e.detail));
 // relay.js is loaded once here, after settings have resolved.
 const script=document.createElement('script');script.src='relay.js';document.body.append(script);
})();
