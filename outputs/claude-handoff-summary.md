# Prism Chat Widget 引き継ぎ資料

## 目的

OBSのブラウザソースに貼り付けて使える、Twitchチャットウィジェットを作成している。
設定画面（`index.html`）でチャンネル名・テーマ・フォント・背景などを設定し、`view.html` のURLを発行してOBSで表示する構成。

## 現在の公開先

- Vercel: `https://sparkle-chat-gamma.vercel.app/`
- GitHub: `https://github.com/gugu219/sparkle-chat`
- Twitch OAuth redirect URL: `https://sparkle-chat-gamma.vercel.app/api/auth/callback`

GitHubリポジトリはPublicに変更済み。

## ファイル構成

- `index.html`: 設定画面、ライブプレビュー、OBS URL発行、Twitch接続ボタン
- `view.html`: OBS用の透明チャット表示画面。URLパラメータを読み込んで表示
- `style.css`: 共通テーマ、レイアウト、アニメーション
- `script.js`: 設定値の反映、URL生成、プレビューイベント、Twitch/TMI接続
- `api/auth/login.js`: Twitch OAuth開始
- `api/auth/callback.js`: OAuth callback、アクセストークン取得、Redis保存
- `api/auth/session.js`: Redisからセッション取得、必要時のトークン更新
- `api/_lib.js`: Redis、OAuth、セッション共通処理

## これまでに実施したこと

1. 最初は静的なHTML/CSS/JSのチャットウィジェットを作成。
2. 設定画面とOBS表示画面を分離。
3. テーマ、フォント、背景、透明度、表示数などをURLパラメータにしてOBS URLを生成。
4. テストイベント（チャット、サブスク、Bits、Tip）を設定画面のiframeプレビューへ送る処理を追加。
5. Twitch OAuth認証を追加。
6. Vercelの環境変数を設定。
7. Upstash Redisをセッション保存用に設定。
8. Twitch側でアプリを作成し、Client ID / Client Secretを発行。
9. Vercelへデプロイし、設定画面から「Twitchで接続」を押すとOAuth認証自体は成功する状態になった。
10. GitHubリポジトリをPublicに変更。

## Vercel環境変数

以下の5つをVercelのProduction and Previewに登録済み。

- `APP_BASE_URL` = Vercel本番URL
- `TWITCH_CLIENT_ID` = TwitchアプリのClient ID
- `TWITCH_CLIENT_SECRET` = TwitchアプリのClient Secret（秘密情報）
- `UPSTASH_REDIS_REST_URL` = Upstash REST URL
- `UPSTASH_REDIS_REST_TOKEN` = Upstash REST Token（秘密情報）

実際のSecret、Token、OAuthコード、widget IDはこの資料には記載しない。

## 発行されるOBS URLの形式

例:

```text
https://sparkle-chat-gamma.vercel.app/view.html?channel=CHANNEL&theme=selene&font=zen&bg=glass&opacity=78&textSize=15&limit=12&blur=1&widget=WIDGET_ID
```

`widget` IDはRedisに保存したOAuthセッションを参照するための値で、公開・共有してはいけない。
以前、widget IDをチャットへ貼り付けたため、旧IDは解除操作で無効化し、新しい認証と新しいOBS URLを発行している。

## 現在確認できている症状

### 1. 認証なしで他人のチャンネルを指定した場合

- 設定画面右下に入力したチャンネル名の小さな表示は出る。
- しかし、ライブ中の他人のTwitchチャンネル名を入力しても、実際のチャットは表示されない。

これは現在の構成では仕様上の制約がある。Twitch IRCはチャット受信にもアクセストークンが必要で、チャンネル名だけで匿名接続することはできない。認証なしで利用できるのは、デザイン確認とテストイベントのプレビューまで。

### 2. Twitch認証済みの場合

- 設定画面で「Twitchで接続」を押すとOAuth画面へ進み、接続済み表示になる。
- 自分のチャンネル名を入力し、自分のライブチャットへ実際にコメントしても、OBS用URL側にチャットが表示されない。
- テストイベントは設定画面のライブプレビュー用であり、OBS用URLへは送られない。
- Vercelで再デプロイしても改善していない。

## 現在のコードの重要な挙動

`script.js` の `view()` は、次の条件を満たさない場合、チャット接続を開始しない。

- `widget` パラメータがある
- `/api/auth/session?widget=...` からRedis上の認証セッションが取得できる
- `channel` パラメータがある
- `tmi.js` が読み込まれている

認証セッション取得に失敗しても、画面上には明確なエラーを出さず処理終了するため、「何も表示されない」ように見える。

## 未解決の可能性が高い原因

1. OBSに貼ったURLの `widget` IDが古い、無効、またはRedisに存在しない。
2. GitHubの最新 `script.js` とVercelの本番デプロイが一致していない。
3. Vercelの `/api/auth/session` が404/500を返している。
4. Upstash Redisの環境変数がProduction側に反映されていない。
5. `tmi.js` のWebSocket接続が失敗しているが、現在は画面にエラーを表示していない。
6. Twitch OAuthで取得したトークンのscope、期限更新、またはIRC接続エラー。
7. OBSブラウザソースが古いURL・古いキャッシュを表示している。

## 優先して確認したい診断手順

秘密のwidget IDは他人に送らず、自分のブラウザだけで確認する。

```text
https://sparkle-chat-gamma.vercel.app/api/auth/session?widget=新しいwidget ID
```

- JSONで `accessToken` と `login` が返る → Redis/OAuthセッションは取得できている。TMI接続側を調査。
- `Not found` → 古いURL、widget ID不一致、またはRedis保存失敗。
- `Internal Server Error` → Vercel環境変数、Upstash、関数エラーを調査。

その後、ブラウザの開発者コンソールまたはOBSブラウザソースのログで、以下を確認する。

- `tmi.js` が読み込まれているか
- `/api/auth/session` のHTTPステータス
- `client.connect()` のエラー内容
- Twitchから `Login authentication failed`、接続拒否、チャンネル参加失敗が出ていないか

## 重要な設計上の結論

- 「認証なしでチャンネル名だけを入力し、リアルタイムチャットを取得」は、現在のTwitch IRC方式では実現できない。
- 「購入者がTwitch認証なしで使える」ようにするには、所有者のトークンをサーバー側だけで管理し、サーバーがTwitch IRCへ接続して各クライアントへ配信する別アーキテクチャが必要。
- 現在のブラウザから直接 `tmi.js` で接続する方式では、少なくとも1つの有効なTwitchアクセストークンが必要。
- 認証済みトークンをブラウザへ返す現在の実装は、widget IDの漏洩対策とエラー表示の改善が必要。

## Claudeに依頼したいこと

1. GitHubの最新コードとVercelのデプロイ内容が一致しているか確認。
2. `/api/auth/session` のレスポンスとVercel Function Logsを確認。
3. `view.html` / `script.js` に接続状態・認証取得失敗・TMI接続失敗を画面表示する診断UIを追加。
4. 認証済み状態で別の公開チャンネルのチャットも読めるか確認。
5. Twitch IRC接続処理を現在の公式仕様に合わせて修正。
6. 必要であれば、アクセストークンをブラウザへ返さないサーバー側中継方式へ設計変更。

