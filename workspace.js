// Operational controls: report saved state and distinguish live output from samples.
(() => {
 const $=s=>document.querySelector(s);
 const integration=$('#connection-summary').closest('section');integration.id='connections';
 const logCard=$('#event-log').closest('section');logCard.id='activity';
 const status=$('#integration-status');let saved=null;
 const request=async(path,options={})=>{const r=await fetch(path,{...options,headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok)throw Error(j.error||'処理に失敗しました');return j;};
 const nav=document.createElement('nav');nav.className='workflow-nav';nav.setAttribute('aria-label','設定の手順');
 for(const [label,action]of [['1. 接続・通知',()=>integration.scrollIntoView({behavior:'smooth',block:'start'})],['2. レイアウト',()=>$('.control-panel').scrollIntoView({behavior:'smooth',block:'start'})],['3. OBSへ出力',()=>{document.querySelector('[data-tab="combined"]').click();$('.control-panel').scrollIntoView({behavior:'smooth',block:'start'});}]] ){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;nav.append(b);
 }
 $('.welcome').append(nav);
 const guidance=document.createElement('p');guidance.className='field-hint';guidance.textContent='通知URLは保存後に非表示になります。「保存済み」なら再入力は不要です。実通知は「まとめ」タブで、各サービスの管理画面からテストしてください。';$('.integration-grid').before(guidance);
 const states={};
 for(const [key,name]of [['doneru','Doneru'],['streamlabs','Streamlabs']]){
  const input=$('#'+key+'-url'),label=input.parentElement;
  const card=document.createElement('div');card.className='service-card';label.before(card);card.append(label);
  const state=document.createElement('span');state.className='service-state';state.id=key+'-saved';state.textContent='保存状態を確認中';state.setAttribute('role','status');card.append(state);states[key]=state;
  input.setAttribute('aria-describedby',state.id);input.addEventListener('input',()=>{state.textContent=input.value.trim()?'未保存の変更があります':saved?.[key]?'保存済み（URLは非表示）':'未設定';});
  const remove=document.createElement('button');remove.type='button';remove.className='service-remove';remove.textContent=name+'の通知設定を解除';remove.disabled=true;card.append(remove);states[key+'Remove']=remove;
  remove.onclick=async()=>{remove.disabled=true;try{await request('/api/integrations',{method:'POST',body:JSON.stringify({[key]:'',...(key==='streamlabs'?{mode:'widget',streamlabsToken:''}:{mode:saved?.mode||'widget'})})});input.value='';await refresh();status.textContent=name+'の通知設定を解除しました。';}catch(e){status.textContent=e.message;remove.disabled=false;}};
 }
 async function refresh(){
  try{saved=await request('/api/integrations');for(const key of ['doneru','streamlabs']){const on=!!saved[key];states[key].textContent=on?'保存済み（URLは非表示）':'未設定';states[key+'Remove'].disabled=!(on||(key==='streamlabs'&&saved.streamlabsApi));$('#'+key+'-url').placeholder=on?'変更するときだけ新しいURLを入力':'OBS用のAlert Box URLを貼り付け';}$('#streamlabs-mode').value=saved.mode;$('#streamlabs-mode').onchange();return true;}
  catch(e){for(const key of ['doneru','streamlabs'])states[key].textContent='確認できません：'+e.message;return false;}
 }
 $('#save-integrations').onclick=async()=>{
  const button=$('#save-integrations');button.disabled=true;button.textContent='保存中…';
  const data={mode:$('#streamlabs-mode').value};for(const key of ['doneru','streamlabs']){const value=$('#'+key+'-url').value.trim();if(value)data[key]=value;}const token=$('#streamlabs-token').value.trim();if(token)data.streamlabsToken=token;
  try{await request('/api/integrations',{method:'POST',body:JSON.stringify(data)});for(const key of ['doneru','streamlabs'])$('#'+key+'-url').value='';$('#streamlabs-token').value='';const verified=await refresh();status.textContent=verified?'保存済みです。「まとめ」を開き、数秒待ってから公式管理画面のテスト通知を送ってください。':'保存処理は完了しましたが、保存状態の確認に失敗しました。再読み込みして確認してください。';}
  catch(e){status.textContent='保存できませんでした：'+e.message;}
  finally{button.disabled=false;button.textContent='連携設定を保存';}
 };
 // Widget mode is the normal path; API mode remains available for existing users.
 const previewStatus=document.createElement('p');previewStatus.id='live-output-status';previewStatus.className='output-status';previewStatus.setAttribute('role','status');$('.preview-stage').after(previewStatus);
 const describe=()=>{previewStatus.textContent=$('#combined-preview').hidden?'表示サンプルのプレビューです。Doneru・Streamlabsの実通知は「まとめ」で確認できます。':window.sparkleOverlay?'通知出力へ接続中…':'外部通知を表示するには、アラートタブでTwitchに接続してください。';};
 window.addEventListener('panelchange',describe);window.addEventListener('sparkle-auth',()=>{refresh();describe();});describe();refresh();
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('#combined-preview').contentWindow||e.data?.source!=='sparkle-health')return;const {ok,message,widgets}=e.data;previewStatus.dataset.state=ok?'ok':'error';previewStatus.textContent=message+(widgets?' / '+['doneru','streamlabs'].map(k=>(k==='doneru'?'Doneru':'Streamlabs')+': '+(widgets[k]?'Widget読み込み対象':'未設定・無効')).join(' / '):'');});
 const hint=document.createElement('p');hint.className='field-hint';hint.textContent='接続中は配信イベントも表示されます。外部Widgetの読み込み対象であっても、表示成功は各サービスのテスト通知で確認してください。';previewStatus.after(hint);
 for(const b of document.querySelectorAll('[data-integration-test]'))b.textContent=b.dataset.integrationTest==='doneru'?'Doneru風の表示サンプル':'Streamlabs風の表示サンプル';
 const open=document.createElement('button');open.type='button';open.textContent='発行したOBS出力を別タブで確認';open.onclick=()=>{const value=$('#combined-url').value;if(!value){$('#combined-copy').focus();status.textContent='先に「4つの設定をまとめてURL発行・コピー」を押してください。';return;}const u=new URL(value);if(u.origin===location.origin&&u.pathname.endsWith('/all.html'))window.open(u.href,'_blank','noopener,noreferrer');};$('#combined-url').parentElement.after(open);
 // Existing collapsible legends also need keyboard access.
 for(const legend of document.querySelectorAll('.settings-form legend')){legend.tabIndex=0;legend.setAttribute('role','button');const sync=()=>legend.setAttribute('aria-expanded',String(!legend.parentElement.classList.contains('is-collapsed')));legend.addEventListener('click',sync);legend.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();legend.click();}});sync();}
})();
