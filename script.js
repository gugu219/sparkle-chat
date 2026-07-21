const chat = document.getElementById('chat');
const tplMsg = document.getElementById('tpl-message');
const tplAlert = document.getElementById('tpl-alert');
let LIMIT = 15;

// URLパラメータを取得する関数
function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    channel: p.get('channel') || '',
    theme: p.get('theme') || 'selene',
    nameFont: p.get('nameFont') || 'mplus-rounded',
    bodyFont: p.get('bodyFont') || 'zen-kaku-gothic',
    bgMode: p.get('bgMode') || 'gradient',
    bgOpacity: p.get('bgOpacity') || '72'
  };
}

function applySettings(cfg) {
  document.body.className = `theme-${cfg.theme} nf-${cfg.nameFont} bf-${cfg.bodyFont} bg-${cfg.bgMode}`;
  document.documentElement.style.setProperty('--bg-opacity', (Number(cfg.bgOpacity) / 100).toString());
}

function getRole(tags) {
  const b = (tags && tags.badges) || {};
  if (b.broadcaster) return { cls: 'sub', badge: 'broadcaster', label: '配信者' };
  if (b.moderator || tags.mod) return { cls: 'mod', badge: 'mod', label: 'Mod' };
  if (b.vip) return { cls: 'sub', badge: 'vip', label: 'VIP' };
  if (b.artist) return { cls: 'sub', badge: 'artist', label: 'Artist' };
  if (b.subscriber || tags.subscriber) return { cls: 'sub', badge: 'sub', label: 'Sub' };
  return { cls: 'reg', badge: '', label: '' };
}

function nameColor(tags) {
  if (tags && tags.color) return tags.color;
  let h = 0, n = (tags && tags['display-name']) || 'u';
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 76%)`;
}

function renderMessage(displayName, tags, text) {
  const role = getRole(tags);
  const node = tplMsg.content.cloneNode(true);
  const msg = node.querySelector('.msg');
  if (role.cls === 'sub') msg.classList.add('msg--sub');
  
  const badge = node.querySelector('.badge');
  if (role.badge) { badge.textContent = role.label; badge.classList.add('badge--' + role.badge); }
  
  const nameEl = node.querySelector('.msg__name');
  nameEl.textContent = displayName;
  nameEl.style.setProperty('--uc-1', nameColor(tags));
  
  const bubble = node.querySelector('.msg__bubble');
  bubble.textContent = text;
  
  chat.prepend(node);
  trim();
}

function renderAlert(type, kindLabel, name, amount, message) {
  if (!tplAlert) return;
  const node = tplAlert.content.cloneNode(true);
  const alertEl = node.querySelector('.alert');
  alertEl.classList.add('alert--' + type);
  node.querySelector('.alert__kind').textContent = kindLabel;
  
  let html = `<span class="a-name">${name}</span> さん`;
  if (amount) html += ` — <span class="a-amt">${amount}</span>`;
  node.querySelector('.alert__line').innerHTML = html;
  node.querySelector('.alert__note').textContent = message || '';
  
  chat.prepend(node);
  trim();
}

function trim() {
  while (chat.childElementCount > LIMIT) {
    chat.lastElementChild.remove();
  }
}

// -----------------------------------------------------------
// ページごとの動作切り替え
// -----------------------------------------------------------
const cfg = getParams();
applySettings(cfg);

// view.html (OBS側) で開かれている場合：Twitchに接続
if (window.location.pathname.includes('view.html')) {
  if (cfg.channel) {
    const client = new tmi.Client({
      channels: [cfg.channel]
    });

    client.connect();

    // 通常チャット受信
    client.on('chat', (channel, userstate, message, self) => {
      renderMessage(userstate['display-name'] || userstate.username, userstate, message);
    });

    // サブスク通知受信
    client.on('subscription', (channel, username, method, message, userstate) => {
      renderAlert('sub', 'New Subscriber', userstate['display-name'] || username, '', message);
    });

    // ビッツ(Cheer)受信
    client.on('cheer', (channel, userstate, message) => {
      renderAlert('cheer', 'Cheer', userstate['display-name'] || userstate.username, `${userstate.bits} Bits`, message);
    });
  }
} 
// index.html (設定画面) で開かれている場合：URL生成ボタンの処理
else {
  const btnGen = document.getElementById('btnGenerate');
  if (btnGen) {
    btnGen.onclick = () => {
      const ch = document.getElementById('inpChannel').value.trim();
      if (!ch) {
        alert('Twitchユーザー名を入力してください！');
        return;
      }
      const theme = document.getElementById('selTheme').value;
      const nameFont = document.getElementById('selNameFont').value;
      const bodyFont = document.getElementById('selBodyFont').value;
      
      const baseUrl = window.location.href.replace('index.html', '').replace(/\/$/, '');
      const generatedUrl = `${baseUrl}/view.html?channel=${ch}&theme=${theme}&nameFont=${nameFont}&bodyFont=${bodyFont}&bgMode=${cfg.bgMode}`;
      
      navigator.clipboard.writeText(generatedUrl).then(() => {
        alert('OBS用URLをコピーしました！OBSのブラウザソースに貼り付けてください。');
      });
    };
  }
}
