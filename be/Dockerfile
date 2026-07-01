# Multi-stage build for the Echo backend, deployable to Google Cloud Run.
#
# Deploy (from echo-backend/be):
#   gcloud run deploy echo-backend --source . --region REGION \
#     --min-instances=1 --set-env-vars NODE_ENV=production \
#     --update-secrets FIREBASE_SERVICE_ACCOUNT_JSON=...,GEMINI_API_KEY=...
#
# Cloud Run injects PORT (default 8080); src/lib/config.ts honors process.env.PORT.

# ---- build stage ----
FROM node:20-slim AS build
WORKDIR /app

# Install all deps (incl. dev) for the TypeScript build.
COPY package.json package-lock.json ./
RUN npm ci

# Compile src -> dist.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies for a lean runtime node_modules.
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the built-in non-root "node" user.
USER node

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json ./

# Cloud Run sets PORT; EXPOSE is documentation only.
EXPOSE 8080

# index.ts installs SIGTERM/SIGINT handlers for graceful shutdown on scale-in.
CMD ["node", "dist/index.js"]
