# Sparkle Chat 更新版

2026-09-23の https://sparkle-chat-necocream.vercel.app/ の公開HTML/CSS/JSを取得して改修した版です。公開サイトの主要ファイル（index.html、script.js、all.js）は、このリポジトリの変更前のmainと内容が一致しました。バックエンドは旧作業フォルダーのAPIを参考に再実装しました。

## 起動

Node.js 22以上でこのフォルダーを開き、`node dev-server.mjs` を実行します。http://127.0.0.1:4173/ を開いてください。追加npmパッケージは不要です。ローカルでは画面・自作枠プレビュー・サンプル通知を確認できます。認証・保存・実通知には以下の本番設定が必要です。

## 本番設定（Vercel）

1. gugu219/sparkle-chat のこのブランチでVercel Previewを確認します。フレームワークは Other、ビルドなし。接続先はVercelの `necocream/sparkle-chat` プロジェクトです。`sparkle-chat-gamma.vercel.app` が本番ドメインで、`sparkle-chat-necocream.vercel.app` もVercelのデフォルトドメインとして表示できます。Twitch認証時はAPP_BASE_URLに設定したgammaドメインからアクセスします。
2. `.env.example` の全変数をVercelに設定します。Client Secret等の実値をファイルへコミットしないでください。APP_ENCRYPTION_KEYとTWITCH_WEBHOOK_SECRETは独立した32文字以上のランダム値です。
3. Twitch開発者コンソールのOAuthリダイレクトURLを `https://sparkle-chat-gamma.vercel.app/api/auth/callback` に登録します。APP_BASE_URLとアクセス先のoriginは一致させます。
4. HTTPS環境へデプロイ後、アラートタブからTwitchを接続します。購読ごとのエラーがあれば権限・Client ID・配信者アカウントを確認し、「購読を再試行」を使用します。
5. 自作枠を選び「枠画像を保存する」を押します。設定を調整後、「まとめ」でURLを発行し、OBSのブラウザソースを1920×1080にします。
6. 各サービスの公式管理画面から実通知テストを実施してください。Sparkle Chatの「サンプル」は描画テストであり、外部サービスの接続テストではありません。

## 実装内容

- 全プレビューを論理1920×1080に統一。縮小／100%表示、同一レンダラーによるOBS出力。
- PNG/JPEG/WebPの自作枠。位置・サイズ・不透明度・チャットとの前後関係。最大1.8 MB。Redisに1年保存し、短い画像IDで共有。
- 枠・チャット・アラート・テロップ・公式通知Widgetを一つのOBS出力へ合成。
- Twitch OAuth stateの使い捨て、HttpOnly Cookieで配信者認証、サーバー側のトークン暗号化／更新／時間ごとの検証。旧widget IDからトークンを返す経路を廃止。
- Hype Train EventSub v2を署名検証付きWebhookへ変更。フォロー・チャット通知・Bits・配信開始終了も購読。通常のチャットは既存匿名IRC接続を維持。
- Twitch・Streamlabs API通知の共通形式、表示キュー、イベントIDによる重複抑止。ログは配信者Cookieのみ、30日保持、画面は直近300件、絞り込み・表示中ログのJSON保存。
- Twitchのwatch_streak通知を安定したユーザーIDに紐付け、配信IDごとに表示。配信終了通知／手動の配信終了でバッジを解除。日付変更では解除しません。累計回数を独自に増減しません。
- クリーム・テラコッタ・セージ色の設定画面。小さな装飾、丸いボタン、キーボードフォーカス、動きを減らす設定に対応。

## Doneru / Streamlabs

Doneruは公式Alert Box URLを登録してiframeに合成します。公式に公開された寄付イベントAPIを確認できていないため、Doneruの寄付者・金額・メッセージの自動ログ取得や独自通知は実装していません。埋め込み先のCSP/X-Frame-Options、OBSでの音声再生は実アカウントのURLで検証が必要です。

Streamlabsは公式Widget表示または公式v2 Donations APIモードを選びます。APIモードは`donations.read`アクセストークンを配信者設定から保存し、サーバー側で暗号化します。15秒以上の間隔で取得し、複数ページを読み込み、donation_idで重複を抑止します。初回接続では既存履歴を通知しません。APIモードではStreamlabs Widgetを重ねず二重通知を防ぎます。トークン失効時は手動更新が必要です。StreamlabsのOAuthアプリ登録・自動更新フローは未実装です。

OBS出力が開いている間だけAPIをポーリングします。通知遅延は通常15秒程度＋描画取得間隔。切断後の再接続では2分以内の描画イベントを取得し、それ以前の取得済みイベントはログにのみ保持します。複数OBSソースを同時に開くとそれぞれが表示します。公式Widgetの通知はSparkle Chat側のキューやログでは制御できません。

## 公開範囲

OBS URLは読み取り用の推測困難なIDです。OAuthトークンやWidget URLそのものはクエリに含みません。ただしOBS URLを知る人は表示情報を閲覧でき、Widgetを表示するブラウザーは埋め込み元URLを取得できます。OBS URLを一般公開しないでください。完全な秘密URLの隠蔽はiframe方式では不可能です。連携解除後の再接続で読み取りIDを更新します。所有者Cookieは30日です。

## 確認状況

`node --test tests/server.test.mjs`：12テスト成功（認証、秘密情報非露出、署名・時刻検証、重複通知、配信終了、Streamlabsページング）。JavaScript全ファイルの構文チェック成功。

ブラウザーで設定画面の起動、論理1920×1080、透過枠の読み込みと「まとめ」表示、12連続視聴サンプル、サンプルログを確認しました。Vercel本番デプロイと両ドメインでの新画面表示を確認しました。実Twitch OAuth、購読受付後の有効化、Doneru/Streamlabs公式テスト通知、OBS実機表示は未検証です。

連携の設計根拠と残作業は IMPLEMENTATION.md を参照してください。
