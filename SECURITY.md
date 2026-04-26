# Security Policy

Echo Backend handles **life-safety data**: SOS messages, rescuer locations, agency dispatch decisions. We treat security reports with the seriousness they deserve.

## Supported Versions

This repository is in active prototype development for **Google Solution Challenge 2026**. Only the `main` branch is supported.

| Version | Supported |
|---|---|
| `main` | yes |
| anything else | no |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.**

Instead, use one of:

1. **GitHub Private Vulnerability Reporting** — `Security` tab → *Report a vulnerability*.
2. **Email** — open a placeholder issue titled "Security contact request" (without details) and a maintainer will respond with an encrypted channel.

Please include:

- Affected package (`be/` or `fe-admin/`)
- A clear description and impact assessment
- Step-by-step reproduction (curl request, browser action, …)
- Affected commit / version
- Whether you intend to disclose publicly, and on what timeline

We aim to:

- Acknowledge within **72 hours**
- Provide an initial assessment within **7 days**
- Ship a fix or mitigation within **30 days** for High/Critical issues

We will credit you in release notes unless you ask us not to.

## Scope

In scope:

- Authentication & authorization (`be/src/middleware/authz.ts`, `app-check.ts`, `rescuer-jwt.ts`)
- Rate-limiting and CORS bypass
- Firestore rules (`be/firestore.rules`)
- Server-side rendering / XSS / CSRF in `fe-admin/`
- Secret leakage in API responses or logs
- Privilege escalation (e.g. `medical` operator accessing `police` data)
- Replay or spoofing of mobile-mesh ingest

Out of scope:

- Vulnerabilities in third-party dependencies — please report upstream first
- Generic Google Cloud / Firebase platform issues — report to Google
- Issues requiring physical access to an unlocked operator workstation

## Hardening posture

The backend already implements:

- **Three-tier auth** — Firebase ID tokens (operators), shared ingest token (mesh), RS256 rescuer JWTs (rescuers).
- **Firebase App Check** required on production ingest.
- **Helmet** with strict CSP, HSTS, frameguard, no-sniff, referrer policy.
- **CORS allowlist** — exact-match, configured via `CORS_ORIGINS`.
- **Rate limits** — 300/min global, 120/min ingest, per IP.
- **32 KB JSON body cap** — mesh packets fit comfortably; anything larger is rejected.
- **Constant-time token compare** for the shared ingest token.
- **Firestore rules with role+agency RBAC** — denied-by-default.
- **`trust proxy = 1`** — correct client IP behind load balancers.
- **No secrets in source** — everything flows through `.env` / runtime config.
- **JWKS endpoint** at `/.well-known/jwks.json` for stateless rescuer-JWT verification.

If you find a way around any of the above, we **especially** want to hear from you.

## Responsible disclosure

We follow a 90-day coordinated-disclosure window by default and are happy to negotiate longer for systemic issues that require infrastructure rollout.

Thank you for helping keep Echo — and the people who depend on it — safe.
