# Contributing to Echo Backend

Thanks for taking the time to contribute! Echo Backend powers the cloud half of [Echo](https://github.com/0xteamCookie/echo), a Google Solution Challenge 2026 project addressing **Rapid Crisis Response**.

This repo is a **two-package monorepo**:

- [`be/`](be/) — Express 5 API on Node 20
- [`fe-admin/`](fe-admin/) — Next.js 16 operator console

## Code of Conduct

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## Ways to contribute

- **Report a bug** — Open an issue with the *Bug report* template. Include which package (`be` or `fe-admin`), exact request/response, log excerpt.
- **Suggest a feature** — Use the *Feature request* template. Anchor it to operator or rescuer workflows.
- **Improve docs** — Typos, deployment notes, env-var clarifications. PRs welcome.
- **Report a vulnerability** — **Do not open a public issue.** See [SECURITY.md](SECURITY.md).

## Development setup

See the [Local development](README.md#local-development) section of the root README. Short version:

```bash
# Terminal 1 — backend
cd be && cp .env.example .env && npm install && npm run dev

# Terminal 2 — operator console
cd fe-admin && cp .env.example .env.local && npm install && PORT=3001 npm run dev
```

You will need:

- A **Firebase project** with Auth + Firestore enabled
- A **Gemini API key** from [aistudio.google.com](https://aistudio.google.com)
- A **Google Maps API key** (Distance Matrix enabled) — optional in dev (`DISTANCE_MATRIX_ENABLED=false`)

## Pull-request checklist

Before opening a PR:

- [ ] `npm run build` succeeds in the package(s) you touched (`be/` and/or `fe-admin/`).
- [ ] `npm run lint` is clean in `fe-admin/` if you touched the frontend.
- [ ] No secrets, service-account JSON, or `.env*` files committed (check `git status` carefully).
- [ ] If you changed Firestore rules or indexes, you have **tested locally with the emulator** and updated [`be/firestore.rules`](be/firestore.rules) / [`be/firestore.indexes.json`](be/firestore.indexes.json) accordingly.
- [ ] If you added an env var, document it in `.env.example` **and** the relevant README.
- [ ] If you added a backend route, document it in the routes table of [README.md](README.md) and `be/README.md`.
- [ ] Breaking changes to the mobile-facing API contract (`/api/data`, `/api/rescuer/heartbeat`, `/api/announcement`) are flagged in the PR description and CHANGELOG.

## Coding conventions

### Backend (`be/`)

- TypeScript strict mode (`tsconfig.json` already enables it).
- **Modules under `src/modules/<feature>/`** — keep `routes.ts`, `service.ts`, and types colocated.
- **Validation at the edge** — every route handler validates input before doing work.
- **No business logic in routes** — keep handlers thin; logic lives in `*.service.ts`.
- **Use the logger** in `lib/logger.ts`, never raw `console.log` in production paths.
- **Feature flags** in `lib/config.ts` — default-off in dev, default-on in prod.
- **Firestore writes** go through `lib/firebase.ts`, never re-init Admin elsewhere.

### Frontend (`fe-admin/`)

- Use the **App Router** (`src/app/`); do not introduce `pages/`.
- **Tailwind v4 utility-first** — no CSS files except globals.
- **Server Components by default**; opt into `"use client"` only when needed (Firebase SDK, hooks, maps).
- API calls go through `lib/api-client.ts` so the Firebase ID token is attached automatically.
- Realtime data comes from `useRealtimeEvents` (Firestore `onSnapshot`), not polling.

## Commit messages

Loosely [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(be/dispatch): rank rescuers by ETA + load
fix(fe-admin/live-feed): handle missing meta.triage gracefully
docs(be): document PUBSUB_PUSH_TOKEN
chore(deps): bump @google/generative-ai to 0.24.2
```

Prefix the scope with the package: `feat(be/...)`, `fix(fe-admin/...)`, `docs(...)` (root docs).

## License

By contributing, you agree your contributions will be licensed under the [MIT License](LICENSE).
