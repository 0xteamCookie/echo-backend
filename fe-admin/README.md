# `fe-admin/` — Echo Operator Console (DisasterOps)

Next.js 16 + React 19 + Tailwind v4 single-page operator console. The "DisasterOps" dashboard where 911-style dispatchers watch real-time mesh ingest, review Gemini triage, assign rescuers, and broadcast multilingual announcements.

> For end-to-end architecture see the [monorepo README](../README.md).

## Stack

| | |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Runtime | React 19.2 |
| Styling | Tailwind v4 (`@tailwindcss/postcss`) |
| Icons | `lucide-react` |
| Maps | `@vis.gl/react-google-maps` |
| Charts | `recharts` 3.8 |
| Realtime | Firebase JS SDK 11 — Firestore `onSnapshot` |
| Auth | Firebase Auth (client SDK) |
| Data fetching | `swr` |
| QR | `qrcode.react` (rescuer provisioning) |

> No shadcn, no MUI, no NextAuth. No Next API proxy — the browser talks to [`be/`](../be) directly with the user's Firebase ID token attached.

## Routes

| Path | Page | Purpose |
|---|---|---|
| `/` | Overview | Map heatmap + latest announcement |
| `/login` | Login | Firebase Auth sign-in |
| `/live-feed` | Live feed | Realtime `device_entries` table |
| `/dispatch` | Dispatch | Agentic Dispatch panel — Gemini ranking + assign |
| `/announcement` | Announcement | Multilingual broadcast composer with map picker |
| `/map` | Operations map | Full SOS map |
| `/provision` | Provision | Issue rescuer QR-JWT (`super_admin` only) |
| `/settings` | Settings | Admin settings (gated by `settings:read`) |

## Project layout

```
fe-admin/
├── src/
│   ├── app/                    # App Router routes (see table above)
│   ├── components/
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── EventTable.tsx
│   │   ├── IncidentDrawer.tsx
│   │   ├── AgenticDispatchPanel.tsx
│   │   ├── AnnouncementPanel.tsx
│   │   ├── AnnouncementLocationMap.tsx
│   │   ├── LatestAnnouncement.tsx
│   │   ├── StatCard.tsx · DataCard.tsx
│   │   ├── auth/
│   │   └── map/
│   ├── hooks/
│   │   └── useRealtimeEvents.ts    # Firestore onSnapshot
│   ├── lib/
│   │   ├── api-client.ts           # attaches Bearer Firebase ID token
│   │   └── auth/                   # session provider, can(...) permissions
│   └── proxy.ts                    # Next middleware: CSP, HSTS, noindex
├── public/
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

## Realtime data

Operators see incidents the **moment** they're written by `be/` via direct Firestore subscriptions:

```ts
// src/hooks/useRealtimeEvents.ts
const q = query(
  collection(db, "device_entries"),
  where("agency", "==", agency),
  where("receivedAt", ">=", since),
  orderBy("receivedAt", "desc"),
  limit(500)
);
const unsub = onSnapshot(q, snap => setEvents(snap.docs.map(d => d.data())));
```

Reads are gated by [`be/firestore.rules`](../be/firestore.rules), so a `medical` operator cannot subscribe to `fire`-only data even client-side.

## Authentication

Sign-in is **Firebase Auth** via the client SDK (Google / email-password). After sign-in:

- `lib/api-client.ts` attaches `Authorization: Bearer <id-token>` to every fetch to the backend.
- `lib/auth/` exposes a session context with `role` + `agencies[]` from custom claims.
- `Sidebar.tsx` uses `can(session, "data:write")`-style guards to hide UI elements.

There is **no API proxy** in this app. Calls go straight to `be/`. Make sure `CORS_ORIGINS` in `be/.env` includes the operator-console origin.

## Scripts

```bash
npm run dev      # Next dev server
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

By default Next listens on `:3000`. Since `be/` also defaults to `:3000`, run the console on a different port:

```bash
PORT=3001 npm run dev
```

## Environment variables

Copy `.env.example` to `.env.local`.

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | yes | e.g. `http://localhost:3000` or `https://echo-back.getmyroom.in` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | yes | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | yes | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | yes | Maps JS API enabled |

All `NEXT_PUBLIC_*` values are baked into the client bundle — they are not secrets, but they should be locked down in the Google Cloud / Firebase consoles (HTTP-referrer restrictions, App Check, etc.).

## Hardening

`src/proxy.ts` (the Next middleware) sets:

- `Content-Security-Policy` with strict `default-src 'self'`
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Robots-Tag: noindex` (the operator console must never be indexed)

## Bootstrap a super admin

After signing in once with the email you want to promote:

```bash
cd ../be
npx tsx scripts/set-super-admin.ts admin@your-domain.com
```

This sets the `role: super_admin` Auth custom claim and writes `users/{uid}` in Firestore, unlocking `/provision` and `/settings`.

## Deployment

Either:

- **Firebase Hosting** — `firebase deploy --only hosting` after `npm run build && npm run export` (Next 16 supports static export when no SSR-dependent routes are present).
- **Vercel** — connect the repo and set the env vars above.
- **Cloud Run** — `next start` in a Node 20 container.
