# 実装メモと検証対象

## 現行調査

公開サイトはチャット／枠／アラート／テロップ／まとめの5画面。チャットプレビューは従来幅440px設計、他は1920×1080。旧資料の本番URLはsparkle-chat-gamma.vercel.appですが、今回のnecocreamドメインのindex.html、script.js、all.jsはgugu219/sparkle-chatの変更前mainとSHA-256が一致しました。VercelプロジェクトのGit接続設定は別途確認が必要です。

「OAuth Status Click Failed」そのものは実アカウントで再現していません。確認できた不具合は、Hype Train v1購読、購読HTTPエラーの無視、セッションAPIが公開widget IDだけでアクセストークンを返すこと、APP_BASE_URL依存の認証リダイレクト、再接続時の複数ソケット発生の可能性です。v2 Webhookへ置き換え、実環境に依存する認証失敗は画面とAPIで区別できるようにしました。

## 公式資料（2026-09-23確認）

- Twitch EventSub購読・Hype Train v2 / channel:read:hype_train: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- Twitchイベント形式・watch_streak / streak_count: https://dev.twitch.tv/docs/eventsub/eventsub-reference/
- Twitch Webhook HMAC検証・再送: https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
- Twitchトークンの起動時・毎時検証: https://dev.twitch.tv/docs/authentication/validate-tokens/
- Streamlabs公式Widgetとは別にリアルタイムSocket APIが存在: https://dev.streamlabs.com/docs/socket-api
- 今回使用したStreamlabs公式Donations API v2: https://dev.streamlabs.com/reference/donations
- Streamlabs donations.read権限: https://dev.streamlabs.com/docs/scopes
- Doneru公式OBS導入マニュアル: https://doneru.jp/doneru_obs_manual.pdf

Socket APIは公式に確認できましたが、Vercelで常時動作するサーバーSocketを用意せずにトークンをOBSへ渡すのを避けるため、今回のStreamlabs独自通知はサーバー側Donations APIポーリングを採用しました。Doneruは公式URL埋め込みを採用し、非公開APIの推測実装はしていません。

## 本番前の受け入れ確認

- VercelプロジェクトのGit接続とnecocreamドメイン設定を確認する。
- 必須環境変数を設定し、Twitchで許可→コールバック→所有者Cookie→購読受付・Webhook challenge→実イベントの流れを確認する。
- Twitch権限を拒否した場合、Cookie/stateが切れた場合、アクセストークンが失効した場合、フォロー権限が不足した場合の画面を確認する。
- 保存した枠画像IDとまとめURLを別端末のOBSで開き、1920×1080、透過、位置、前後関係を確認する。
- Doneru/Streamlabsの実Widget URLを登録し、公式管理画面から通知テスト。埋め込み拒否の有無、音声、自動再生を確認する。
- Streamlabs APIモードは実donations.readトークンで初回基準点・新着・再接続・失効を確認する。
- 本配信のwatch_streak、配信中再読み込み、日付をまたぐ配信、stream.offline、手動解除、次回配信のバッジを確認する。

## 制約

- 実アカウントの秘密情報・連携権限はこの作業では取得していません。
- DoneruとStreamlabs Widget埋め込みでは寄付データは取得しません。外部Widgetの通知に対する共通キューや重複排除もできません。
- Streamlabs APIトークンの自動更新、Doneru公式イベントAPI連携、アラート専用画像選択は未実装です。既存の音声・色・表示時間設定は維持しています。
- Webhookは通常再送がありますが、Redisの保存障害や極端な大量通知の完全な耐障害性は保証しません。運用規模が増えたら専用イベントキュー・監視を追加してください。
- 枠の削除操作は表示設定から外す操作です。保存した画像は既存URL互換性のため1年で自然失効します。
