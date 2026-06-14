# Backend Architecture Context (for Diagram Generation)

This document describes the backend end-to-end flow for the `be` service, including AI agents (triage + recommendation/dispatch), data stores, and external integrations.

## 1) System Role and Runtime

- Runtime: Node.js + TypeScript + Express.
- Entry points:
  - `be/src/index.ts` boots the process.
  - `be/src/app.ts` configures middleware and mounts all API routes.
- Primary datastore: Firestore.
- Optional fan-out/analytics: Google Pub/Sub and BigQuery.
- Optional notifications: Firebase Cloud Messaging (FCM).
- AI model provider: Google Gemini (`@google/generative-ai`), used in two places:
  - Triage agent (`triage-agent.service.ts`)
  - Dispatch recommendation agent (`dispatch.service.ts`)

## 2) Request Lifecycle (Global Middleware Order)

Defined in `be/src/app.ts`.

1. `helmet()` security headers.
2. CORS allowlist (`config.corsOrigins`) with local dev origins auto-allowed in non-prod.
3. JSON body parser with `32kb` limit.
4. Global rate-limit (`300 req/min/IP`).
5. Ingest-specific rate-limit on `/api/data` (`120 req/min/IP`).
6. Health endpoints:
   - `GET /healthz` (liveness)
   - `GET /readyz` (readiness, Firestore connectivity check with timeout)
7. Public JWK endpoint:
   - `GET /.well-known/jwks.json` for rescuer JWT verification.
8. Identity middleware:
   - `identifyUser` populates `req.user` from ingest token, dashboard JWT, or Firebase ID token.
9. Static file serving (`public`).
10. API routers mounted under `/api/*`.
11. Global error handler (`errorHandler`).

## 3) Authentication and Authorization Model

## 3.1 Identity Sources (`identifyUser`)

From `be/src/middleware/authz.ts`:

- **Ingest token** (`BEACON_INGEST_TOKEN`) via `Authorization: Bearer ...`
  - Sets low-trust `req.user.type = "ingest"`.
- **Dashboard JWT** (HS256, secret `DASHBOARD_JWT_SECRET`)
  - Parsed via `verifyDashboardJwt`.
- **Firebase ID token** fallback
  - Verified by Admin SDK; role/agencies loaded from token claims and/or `users/{uid}`.

## 3.2 Role/permission checks

- Permissions:
  - `data:read`
  - `data:write`
  - `provision:issue`
- `super_admin` has all permissions.
- Non-admin agency roles can read/write data but cannot issue provisioning tokens.
- Route guards:
  - `requirePermission("...")`
  - `requireIngestAuth` (ingest token or user with `data:write`)
  - `requireRescuerJwt` (for rescuer mobile APIs)
  - `requireAppCheck` on ingest APIs when enabled.

## 4) API Surface by Module

## 4.1 Auth (`/api/auth`)

- `POST /login`
  - Validates against `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`
  - Returns dashboard JWT.
- `GET /me`
  - Requires `data:read`
  - Returns current authenticated user info.

## 4.2 Account (`/api/account`)

- `GET /me`
- `PATCH /me`
- Backed by Firestore `users` profile data.

## 4.3 Announcement (`/api/announcement`)

- `GET /`
  - List announcements (with geo/language behavior in service layer).
- `POST /`
  - Requires `data:write`
  - Creates announcement.
- Optional translation pipeline in `translation.service.ts` (Cloud Translation) if enabled.

## 4.4 Data / Beacon Ingest (`/api/data`)

- `POST /` (single ingest)
  - Guards: `requireAppCheck` + `requireIngestAuth`.
- `POST /batch` (up to 500 packets)
  - Same guards.
- `GET /heatmap` (requires `data:read`).
- `GET /` list incident/device entries (requires `data:read`).
- `POST /:id/status` set status (`acknowledged|resolved|assigned|pending`) (requires `data:write`).

Backed by `device_entries` collection.

## 4.5 Dispatch (`/api/dispatch`)

- `GET /recommendations` (requires `data:read`)
  - Generates ranked incident->rescuer recommendations.
- `GET /rescuers` (requires `data:read`)
  - Lists responders for UI assignment dropdown.
- `POST /assign` (requires `data:write`)
  - Writes assignment to `dispatches/{messageId}` and mirrors onto `device_entries`.
- `POST /dev/seed-rescuers` (requires `data:write`)
  - Dev helper for synthetic rescuer docs.

## 4.6 Provision (`/api/provision`)

- `POST /token` (requires `provision:issue`, effectively super-admin)
  - Issues RS256 rescuer JWT containing scope/location/radius claims.
  - Uses service-account key material (`jwt-provisioning.ts`).

## 4.7 Rescuer (`/api/rescuer`)

- `POST /heartbeat` (rescuer JWT)
  - Upserts `rescuers/{sub}` location, duty state, specialties, telemetry.
- `POST /sos/:id/resolve` (rescuer JWT)
  - Marks incident resolved, with agency-scope enforcement.

## 4.8 Push (`/api/push`)

- `POST /register` (rescuer JWT)
  - Registers/refreshes FCM token in `rescuer_tokens/{rescuerId}`.

## 4.9 Pub/Sub Worker Endpoint (`/api/pubsub`)

- `POST /triage-push`
  - Receives Pub/Sub push envelope.
  - Validates shared token (`PUBSUB_PUSH_TOKEN`).
  - Extracts record id and runs triage safely.

## 5) AI Agents and Their Exact Roles

## 5.1 Triage Agent (incident understanding + severity)

File: `be/src/modules/triage/triage-agent.service.ts`

### Trigger

- Invoked after a **new non-deduplicated ingest**.
- Execution mode:
  - Inline during ingest when `TRIAGE_ASYNC=false`
  - Async via Pub/Sub push endpoint when `TRIAGE_ASYNC=true`

### Inputs assembled for model

- Current incident record.
- Prior thread for same device (`macAddress`) up to recent messages.
- Nearby incidents (radius `TRIAGE_NEARBY_RADIUS_M`).
- Untrusted user-originated text is sanitized and fenced in prompt markers.

### Output contract

Gemini returns strict JSON schema fields:
- `categories[]`
- `severity` (1..5)
- `summary`
- `victimInstructions[]`
- `dispatchMessage`
- `reasoning`

### Persistence and side effects

- Merges into `device_entries/{id}.meta.triage`.
- Adds metadata (`triagedAt`, `triageModel`).
- On failure, writes `meta.triageError` (ingest still succeeds).
- If `severity >= 3`, calls FCM incident alert flow.

## 5.2 Dispatch Recommendation Agent (responder selection)

File: `be/src/modules/dispatch/dispatch.service.ts`

### Trigger

- Called by `GET /api/dispatch/recommendations`.

### Incident candidate building

- Loads recent rows from `device_entries`.
- Drops rows with no GPS, resolved status, stale age, or below severity threshold.
- Sorts and trims to requested max incidents.

### Responder candidate building

- Loads on-duty responders from `rescuers` collection.
- Filters by incident agency hints and caller agency scope.
- Computes ETA per responder:
  - Distance Matrix API when enabled and key provided.
  - Haversine fallback otherwise.
- Scores and shortlists top candidates.

### Model decision path

- If `GEMINI_API_KEY` exists, model receives incident brief + shortlist.
- JSON schema-constrained output:
  - `selectedResponderId`, `confidenceLevel`, `rationale`, `escalate`.
- Guardrails enforce:
  - selected responder must exist in shortlist
  - agency compatibility
  - confidence clamping and rationale length bounds
- If model unavailable/fails, deterministic fallback picks closest candidate.

### Final coordination constraints

- Prevents assigning same responder to multiple incidents in a single recommendation run (reassigns with escalation note when needed).
- Returns recommendation payload including provisioning preset.

## 6) Data Model / Collections

Primary Firestore collections observed in code:

- `device_entries`
  - Core incident/beacon records
  - Stores status, assignment mirror, triage metadata/errors.
- `users`
  - Dashboard/Firebase user profiles (role/agencies/email).
- `announcements`
  - Public/admin announcements (+ translations metadata).
- `rescuers`
  - Live rescuer state used by dispatch (on-duty, location, specialties).
- `rescuer_tokens`
  - FCM registrations keyed by rescuer id.
- `dispatches`
  - Assignment records created by admin dispatch action.

## 7) External Integrations and Their Purpose

- Firebase Admin SDK:
  - Firestore, Auth token verification, App Check verification, FCM.
- Gemini API:
  - Triage and dispatch recommendation support.
- Google Pub/Sub:
  - Asynchronous ingest fan-out and triage worker trigger.
- BigQuery:
  - Streaming ingest records for analytics/reporting.
- Google Maps Distance Matrix:
  - Optional drive-time ETA for dispatch scoring.
- Cloud Translation:
  - Optional announcement localization.

## 8) End-to-End Operational Flow (Beacon -> AI -> Dispatch -> Rescue)

1. Mobile/client sends beacon to `POST /api/data`.
2. App Check token verified (if enabled).
3. Ingest auth verified (shared ingest token or authorized dashboard user).
4. Payload validated and normalized.
5. `dataService.create` writes to `device_entries` with dedup logic.
6. If deduplicated:
   - Return `200` with existing/current record reference.
7. If new:
   - Return `201` with created record.
   - Fire-and-forget publish to Pub/Sub.
   - Fire-and-forget stream to BigQuery.
   - Trigger triage:
     - inline or async depending on `TRIAGE_ASYNC`.
8. Triage agent classifies and scores severity.
9. Triage merged into record.
10. If high severity (`>=3`), FCM incident alert sent to relevant agency token set.
11. Admin UI requests `/api/dispatch/recommendations`.
12. Dispatch recommendation agent returns best responder suggestions per incident.
13. Admin confirms assignment via `/api/dispatch/assign`.
14. Assignment persisted in `dispatches` and mirrored to `device_entries`.
15. Rescuer app keeps presence current via `/api/rescuer/heartbeat`.
16. Rescuer resolves incident via `/api/rescuer/sos/:id/resolve`.

## 9) Feature Flags / Important Environment Variables

Core + security:
- `NODE_ENV`, `PORT`, `CORS_ORIGINS`
- `DASHBOARD_JWT_SECRET`
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`
- `BEACON_INGEST_TOKEN`
- `APP_CHECK_ENABLED`

AI:
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `TRIAGE_ENABLED`
- `TRIAGE_ASYNC`
- `TRIAGE_NEARBY_RADIUS_M`

Push:
- `FCM_ENABLED`

Pub/Sub:
- `PUBSUB_ENABLED`
- `PUBSUB_TOPIC_INGEST`
- `PUBSUB_PUSH_TOKEN`

BigQuery:
- `BIGQUERY_ENABLED`
- `BIGQUERY_DATASET`
- `BIGQUERY_TABLE`

Dispatch ETA enrichment:
- `DISTANCE_MATRIX_ENABLED`
- `GOOGLE_MAPS_API_KEY`

Provisioning/JWT:
- `JWT_ISSUER`
- `JWT_DEFAULT_EXPIRES_SECONDS`
- `JWT_MAX_EXPIRES_SECONDS`
- `JWT_AUDIENCE` (optional in provisioning lib)

Firebase/GCP:
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT`

Translation:
- `TRANSLATION_ENABLED`
- `TRANSLATION_TARGET_LANGS`

## 10) Diagram-Oriented Sequence Templates

Use these actor names in an architecture/sequence diagram:

- `Mobile Beacon App`
- `Admin Dashboard`
- `Rescuer App`
- `Express API`
- `AuthZ Middleware`
- `Data Service`
- `Firestore`
- `Pub/Sub`
- `BigQuery`
- `Triage Agent (Gemini)`
- `Dispatch Recommendation Agent (Gemini + Rules)`
- `FCM`
- `Google Maps Distance Matrix`

Suggested main sequence:

1. `Mobile Beacon App -> Express API (/api/data)`
2. `Express API -> AuthZ Middleware` (AppCheck + ingest auth)
3. `Express API -> Data Service -> Firestore(device_entries)`
4. `Data Service -> Pub/Sub` (optional fan-out)
5. `Data Service -> BigQuery` (optional stream)
6. `Data Service -> Triage Agent (Gemini)` (inline or worker-triggered)
7. `Triage Agent -> Firestore(meta.triage update)`
8. `Triage Agent -> FCM` (severity>=3)
9. `Admin Dashboard -> Express API (/api/dispatch/recommendations)`
10. `Dispatch Service -> Firestore(device_entries + rescuers)`
11. `Dispatch Service -> Google Maps Distance Matrix` (optional)
12. `Dispatch Service -> Dispatch Recommendation Agent (Gemini)` (optional; fallback exists)
13. `Admin Dashboard -> Express API (/api/dispatch/assign)`
14. `Express API -> Firestore(dispatches + assignment mirror)`
15. `Rescuer App -> Express API (/api/rescuer/heartbeat, /api/rescuer/sos/:id/resolve)`

---

If you feed this into another AI for architecture visualization, ask it for:
- one **component diagram** (services, stores, external providers),
- one **sequence diagram** for ingest-to-dispatch,
- and one **data-flow diagram** highlighting where AI agents read/write data.
