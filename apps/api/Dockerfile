# AgentTrace API — pnpm monorepo build.
# The workspace consumes @agenttrace/shared as TypeScript source, so the API
# runs under tsx for consistent module resolution between dev and prod.
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api ./apps/api
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate

EXPOSE 4000

# Apply migrations, then start the API.
CMD ["sh", "-c", "pnpm prisma migrate deploy && node --import tsx apps/api/src/index.ts"]
