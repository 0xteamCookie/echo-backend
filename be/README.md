# `be/` — Echo Express API

Stateless Express 5 + TypeScript API on Node 20. The cloud ingest, AI triage, and dispatch brain of [Echo](../). Designed for **Cloud Run**, not Firebase Functions — only Firestore rules + indexes are deployed via the Firebase CLI.

> For end-to-end architecture see the [monorepo README](../README.md).

## Stack

|             |                                                            |
| ----------- | ---------------------------------------------------------- |
| Node        | ≥ 20                                                       |
| Framework   | Express 5.2 + TypeScript 6                                 |
| Identity    | `firebase-admin` 13                                        |
| AI          | `@google/generative-ai` (Gemini 2.5 Flash Lite by default) |
| Maps        | `@googlemaps/google-maps-services-js` (Distance Matrix)    |
| Async       | `@google-cloud/pubsub`                                     |
| Analytics   | `@google-cloud/bigquery`                                   |
| Translation | `@google-cloud/translate` v2                               |
| Hardening   | `helmet`, `express-rate-limit`, `cors`, `jose`             |

## Project layout

```
be/
├── src/
│   ├── index.ts                # process entrypoint
│   ├── app.ts                  # express bootstrap (helmet, cors, rate limits, routes)
│   ├── lib/
│   │   ├── config.ts           # env parsing + feature flags
│   │   ├── firebase.ts         # Admin SDK singleton
│   │   ├── jwt-provisioning.ts # RS256 sign/verify + JWKS
│   │   ├── geo.ts              # haversine, bounding boxes
│   │   └── logger.ts
│   ├── middleware/
│   │   ├── authz.ts            # 3-tier bearer resolver
│   │   ├── app-check.ts        # X-Firebase-AppCheck verifier
│   │   ├── rescuer-jwt.ts      # RS256 caller resolver
│   │   └── identifyUser.ts     # attaches caller to req
│   └── modules/
│       ├── auth/               # /api/auth
│       ├── account/            # /api/account
│       ├── data/               # /api/data        ← mobile ingest
│       ├── triage/             # Gemini triage agent
│       ├── dispatch/           # /api/dispatch    ← Gemini rescuer ranker
│       ├── rescuer/            # /api/rescuer     ← heartbeats
│       ├── push/               # /api/push        ← FCM registration
│       ├── pubsub/             # /api/pubsub      ← async triage
│       ├── announcement/       # /api/announcement
│       ├── provision/          # /api/provision   ← rescuer JWT QR
│       └── bigquery/           # streaming events
├── scripts/
│   ├── set-super-admin.ts
│   └── check-firestore.ts
├── firebase.json               # firestore (rules + indexes) only
├── firestore.rules
├── firestore.indexes.json
├── tsconfig.json
└── package.json
```

## Routes

| Method + path                          | Auth                     | Purpose                                     |
| -------------------------------------- | ------------------------ | ------------------------------------------- |
| `GET /healthz`                         | —                        | Liveness                                    |
| `GET /readyz`                          | —                        | Readiness (Firestore ping, 2 s timeout)     |
| `GET /.well-known/jwks.json`           | —                        | RS256 public key for verifying rescuer JWTs |
| `GET /api/auth/me`                     | operator                 | Operator session info                       |
| `GET PATCH /api/account/me`            | operator                 | Operator profile                            |
| `POST /api/provision/token`            | `super_admin`            | Issue rescuer JWT (QR-encoded)              |
| `POST /api/data`                       | App Check + ingest token | Mobile mesh single ingest                   |
| `POST /api/data/batch`                 | App Check + ingest token | Mobile mesh batch ingest                    |
| `GET /api/data`                        | operator                 | List recent device entries (paginated)      |
| `GET /api/data/heatmap`                | operator                 | Aggregated SOS density                      |
| `POST /api/data/:id/status`            | operator                 | Update incident status                      |
| `GET /api/dispatch/recommendations`    | operator                 | Gemini-ranked top-5 rescuers                |
| `GET /api/dispatch/rescuers`           | operator                 | List on-duty rescuers                       |
| `POST /api/dispatch/assign`            | operator                 | Assign rescuer to incident                  |
| `POST /api/dispatch/dev/seed-rescuers` | dev only                 | Seed test rescuers                          |
| `POST /api/rescuer/heartbeat`          | rescuer JWT              | 2-min duty + GPS heartbeat                  |
| `POST /api/push/register`              | rescuer JWT              | Register FCM token                          |
| `GET /api/announcement`                | —                        | List nearby announcements                   |
| `POST /api/announcement`               | operator (`data:write`)  | Broadcast (auto-translated)                 |
| `POST /api/pubsub/triage-push`         | Pub/Sub push token       | Async triage subscriber                     |

## Scripts

```bash
npm run dev                          # tsx watch on PORT (default 3000)
npm run build                        # tsc → dist/
npm run start                        # node dist/index.js
npm run firebase:deploy:rules        # firebase deploy --only firestore:rules
npm run firebase:deploy:indexes      # firebase deploy --only firestore:indexes

npx tsx scripts/set-super-admin.ts admin@example.com
npx tsx scripts/check-firestore.ts
```

## Environment variables

Copy `.env.example` to `.env` and fill in. Keep production values in your secret manager, **never** in this repo.

### Core

| Var                             | Required | Notes                                                                               |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `PORT`                          | —        | Default `3000`                                                                      |
| `NODE_ENV`                      | —        | `development` / `production`                                                        |
| `CORS_ORIGINS`                  | yes      | Comma-separated allowlist (e.g. `http://localhost:3001,https://admin.echo.example`) |
| `FIREBASE_PROJECT_ID`           | yes      |                                                                                     |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | yes      | Single-line JSON; also used to derive the RS256 JWT signing key                     |

### Mobile ingest

| Var                   | Required | Notes                                                   |
| --------------------- | -------- | ------------------------------------------------------- |
| `BEACON_INGEST_TOKEN` | yes      | Must match the Flutter app's `dart-defines.json`        |
| `APP_CHECK_ENABLED`   | prod     | `true` to require `X-Firebase-AppCheck` on `/api/data*` |

### AI

| Var              | Required | Notes                                                                       |
| ---------------- | -------- | --------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | yes      | From [aistudio.google.com](https://aistudio.google.com) — **NOT** Vertex AI |
| `GEMINI_MODEL`   | —        | Default `gemini-2.5-flash-lite`                                             |
| `TRIAGE_ENABLED` | —        | Default `true` in prod                                                      |
| `TRIAGE_ASYNC`   | —        | `true` to fan out via Pub/Sub `beacon-ingest`                               |

### Maps & Translation

| Var                        | Required | Notes                                   |
| -------------------------- | -------- | --------------------------------------- |
| `GOOGLE_MAPS_API_KEY`      | dispatch | Distance Matrix enabled                 |
| `DISTANCE_MATRIX_ENABLED`  | —        | `false` to skip ETA in dev              |
| `TRANSLATION_ENABLED`      | —        | Default `true` in prod                  |
| `TRANSLATION_TARGET_LANGS` | —        | Default `en,es,fr,de,zh,hi,ar,pt,ja,ko` |

### Async / analytics / push

| Var                   | Required             | Notes                                         |
| --------------------- | -------------------- | --------------------------------------------- |
| `PUBSUB_ENABLED`      | —                    | `true` to publish to Pub/Sub                  |
| `PUBSUB_TOPIC_INGEST` | —                    | Default `beacon-ingest`                       |
| `PUBSUB_PUSH_TOKEN`   | if push subscription | Verified on `/api/pubsub/triage-push?token=…` |
| `BIGQUERY_ENABLED`    | —                    |                                               |
| `BIGQUERY_DATASET`    | —                    | Default `beacon`                              |
| `BIGQUERY_TABLE`      | —                    | Default `events`                              |
| `FCM_ENABLED`         | —                    |                                               |

### Operator bootstrap

| Var                    | Required | Notes                                      |
| ---------------------- | -------- | ------------------------------------------ |
| `SUPER_ADMIN_EMAIL`    | yes      | Used by `scripts/set-super-admin.ts`       |
| `DASHBOARD_JWT_SECRET` | yes      | Reserved for future dashboard-side signing |

## Firestore artifacts

- [`firestore.rules`](firestore.rules) — denied-by-default RBAC keyed on Auth custom claims.
- [`firestore.indexes.json`](firestore.indexes.json) — composite indexes on `device_entries(macAddress, receivedAt)` and `(agency, receivedAt)`.

Deploy:

```bash
npm run firebase:deploy:rules
npm run firebase:deploy:indexes
```

## Deployment (Cloud Run reference)

```bash
gcloud run deploy echo-backend \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --max-instances 50 \
  --set-env-vars "NODE_ENV=production,CORS_ORIGINS=https://admin.echo.example" \
  --set-secrets "FIREBASE_SERVICE_ACCOUNT_JSON=firebase-sa:latest,GEMINI_API_KEY=gemini-key:latest,BEACON_INGEST_TOKEN=ingest-token:latest"
```

`/healthz` and `/readyz` are already wired for Cloud Run health checks.

## Hardening

See the [Auth & security](../README.md#auth--security) section of the monorepo README and [SECURITY.md](../SECURITY.md).
