# `fe-admin/` — Echo operator console

Next.js 16 + React 19 + Tailwind v4 single-page operator console. The dispatcher's dashboard for the [Echo](https://github.com/0xteamCookie/echo) platform.

For project context see the **[main repo](https://github.com/0xteamCookie/echo)** and the [monorepo README](../README.md).

## Architecture

The browser talks to [`be/`](../be) directly with a Firebase ID token. Realtime data comes from **direct Firestore `onSnapshot`** subscriptions gated by `firestore.rules`. There is no Next.js API proxy layer.

## Run locally

```bash
cp .env.example .env.local
npm ci
PORT=3001 npm run dev         # http://localhost:3001
```

Make sure `CORS_ORIGINS` in `be/.env` includes `http://localhost:3001`.

## Routes

| Path | Purpose |
|---|---|
| `/` | Operations overview — heatmap + latest announcement |
| `/login` | Firebase Auth sign-in |
| `/live-feed` | Realtime `device_entries` table |
| `/dispatch` | Gemini-ranked recommendations + assign rescuers |
| `/announcement` | Compose multilingual broadcasts (auto-translated into 10 languages) |
| `/map` | Operations map with all incidents and rescuers |
| `/provision` | Generate rescuer-onboarding QR codes (super_admin only) |
| `/settings` | Admin settings |

## Required environment variables

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | e.g. `http://localhost:3000` or `https://echo-back.getmyroom.in` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JS API enabled |

See [`.env.example`](.env.example) for the complete list.

## Deploy

Vercel (recommended — zero-config) or Firebase Hosting. After deploy, add the public origin to `CORS_ORIGINS` in `be/.env`.

## Hardening

`src/proxy.ts` (Next.js middleware) sets strict CSP, HSTS, frameguard, no-sniff, referrer policy, and `X-Robots-Tag: noindex`.

## License

[MIT](../LICENSE).
