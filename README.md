# Prism Chat OAuth setup

Add an Upstash Redis integration in the Vercel Marketplace, then add all values in `.env.example` to Vercel Project Settings > Environment Variables. Keep `TWITCH_CLIENT_SECRET` private. Set Twitch redirect URL to `https://sparkle-chat-gamma.vercel.app/api/auth/callback`, redeploy, then choose **Twitchで接続**.
