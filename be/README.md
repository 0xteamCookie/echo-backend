# `be/` — Echo Express API

Stateless Express 5 + TypeScript on Node 20. Designed for Cloud Run. Firestore is the only persistent store.

For project context see the **[main repo](https://github.com/0xteamCookie/echo)** and the [monorepo README](../README.md).

## Run locally

```bash
cp .env.example .env          # fill in keys (see below)
npm ci
npm run dev                   # http://localhost:3000

# one-time: promote the first super-admin
npx tsx scripts/set-super-admin.ts you@example.org

# deploy Firestore artifacts
npm run firebase:deploy:rules
npm run firebase:deploy:indexes
```

## Routes

| Mount | Methods | Auth | Purpose |
|---|---|---|---|
| `/healthz`, `/readyz` | `GET` | — | Liveness / readiness (Firestore ping) |
| `/.well-known/jwks.json` | `GET` | — | RS256 public key for rescuer JWTs |
| `/api/auth/me` | `GET` | operator | Operator session info |
| `/api/account/me` | `GET` `PATCH` | operator | Operator profile |
| `/api/provision/token` | `POST` | super_admin | Issue rescuer JWT (QR-encoded) |
| `/api/data` | `POST` `POST /batch` `GET` `POST /:id/status` | ingest token + App Check | Mobile mesh ingest + heatmap query |
| `/api/dispatch/recommendations` | `GET` | operator | Gemini-ranked top-5 rescuers |
| `/api/dispatch/assign` | `POST` | operator | Assign a rescuer |
| `/api/rescuer/heartbeat` | `POST` | rescuer JWT | 2-min duty + GPS heartbeat |
| `/api/push/register` | `POST` | rescuer JWT | Register an FCM token |
| `/api/announcement` | `GET` `POST` | public read / operator write | Multilingual broadcasts |
| `/api/pubsub/triage-push` | `POST` | Pub/Sub token | Async triage subscriber |

## Required environment variables

| Var | Notes |
|---|---|
| `PORT` | Default `3000` |
| `NODE_ENV` | `development` / `production` |
| `CORS_ORIGINS` | Comma-separated allowlist |
| `FIREBASE_PROJECT_ID` | |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Single-line JSON; also derives the RS256 signing key |
| `BEACON_INGEST_TOKEN` | Must match the Flutter app's `dart-defines.json` |
| `GEMINI_API_KEY` | From [aistudio.google.com](https://aistudio.google.com) (not Vertex AI) |
| `GEMINI_MODEL` | Default `gemini-3.1-flash-lite` |
| `GOOGLE_MAPS_API_KEY` | Distance Matrix enabled |
| `SUPER_ADMIN_EMAIL` | Used by `scripts/set-super-admin.ts` |

Optional:

| Var | Notes |
|---|---|
| `APP_CHECK_ENABLED` | `true` to require `X-Firebase-AppCheck` on `/api/data*` (production) |
| `TRIAGE_ASYNC` | `true` to fan out via Pub/Sub `beacon-ingest` |
| `PUBSUB_PUSH_TOKEN` | Verified on `/api/pubsub/triage-push?token=…` |
| `DISTANCE_MATRIX_ENABLED` | `false` to skip the Maps call in dispatch |

See [`.env.example`](.env.example) for the complete list.

## Deploy to Cloud Run

```bash
gcloud run deploy echo-backend \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars-from-file=.env.yaml
```

## Hardening (already wired)

- Helmet (CSP, HSTS, frameguard, no-sniff, referrer policy)
- Strict CORS allowlist
- Rate limit: 300 req/min global, 120 req/min on ingest
- 32 KB JSON body cap
- Constant-time bearer compare
- App Check on production ingest
- `trust proxy = 1` for correct client IP behind Cloud Run

## License

[MIT](../LICENSE).
