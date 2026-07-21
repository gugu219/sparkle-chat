# Prism Chat Widget

OBS用 Twitch チャットオーバーレイ。`index.html` で設定し、発行された `view.html?...` のURLをOBSのブラウザソースに貼り付けて使う。

## チャット表示に Twitch ログインは不要

`view.html` は `tmi.js` の**匿名接続**で任意の公開チャンネルのチャット・Bits・サブスク通知を読み取る。視聴者側・購入者側は Twitch 認証なしで、チャンネル名を入れるだけで表示できる。`vendor/` に tmi.js のブラウザバンドルを同梱しているため、実行時に外部CDNへは依存しない。

`?debug=1` を付けると接続状態やエラーが画面左上に表示される（通常のOBS表示では非表示）。

## OAuth（任意）

OAuth はチャット表示には不要。将来チャットへ**書き込む**機能などを追加する場合にのみ使う。使う場合は Upstash Redis を追加し、`.env.example` の値を Vercel の環境変数に登録。`TWITCH_CLIENT_SECRET` は非公開。Twitch のリダイレクトURLは `https://sparkle-chat-gamma.vercel.app/api/auth/callback`。

## 発行URLの例

```text
https://sparkle-chat-gamma.vercel.app/view.html?channel=CHANNEL&theme=selene&font=zen&bg=glass&opacity=78&textSize=15&limit=12&blur=1
```

`widget` パラメータ（OAuthセッションID）は認証接続する場合のみ付く。付いていれば非公開扱いとし、共有しない。
