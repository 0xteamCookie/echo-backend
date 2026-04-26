# Changelog

All notable changes to **Echo Backend** are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Vertex AI migration path for Gemini agents (currently uses `@google/generative-ai`).
- Cloud Run autoscaling tuning + structured logging integration.
- Replay attack mitigation via per-message HMAC nonce on ingest.

## [0.1.0] — 2026-04 — Solution Challenge 2026 prototype submission

### Added (`be/`)
- Express 5 / Node 20 API with helmet, strict CORS, rate limits, 32 KB JSON cap.
- `/api/data` mesh ingest with App Check + shared bearer token + 30 s dedupe.
- Gemini triage agent with structured output and 5-message thread context.
- Sync and async (Pub/Sub) triage paths via `TRIAGE_ASYNC` flag.
- Gemini dispatch agent ranking top-5 rescuers using Distance Matrix + load + agency match.
- RS256 rescuer-JWT provisioning (QR-encoded), JWKS endpoint at `/.well-known/jwks.json`.
- Rescuer heartbeat + FCM token registration.
- Multilingual announcements via Cloud Translation v2 (10 languages).
- BigQuery streaming inserts to `beacon.events` for Looker Studio.
- Firestore RBAC rules with `super_admin / medical / fire / police` custom claims.
- `set-super-admin.ts` and `check-firestore.ts` operational scripts.

### Added (`fe-admin/`)
- Next.js 16 + React 19 + Tailwind v4 operator console.
- Realtime Firestore `onSnapshot` for `device_entries` (filterable by agency / since / limit).
- Operations map and SOS heatmap (`@vis.gl/react-google-maps`).
- Agentic Dispatch panel — Gemini recommendations + one-click assign.
- Multilingual announcement composer with map picker.
- Rescuer-provisioning page rendering RS256 JWT QR codes.
- Login flow via Firebase Auth client SDK.
- Strict CSP / HSTS / `X-Robots-Tag: noindex` via `src/proxy.ts` middleware.

### Security
- Three-tier auth with constant-time ingest token comparison.
- Firestore RBAC with denied-by-default rules.
- Firebase App Check enforced on ingest in production.
