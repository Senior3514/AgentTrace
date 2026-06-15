# AgentTrace dashboard — Next.js standalone build in a pnpm monorepo.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard

RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @agenttrace/dashboard build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone server + static assets. Tracing root is the monorepo root, so the
# server entry lands under apps/dashboard.
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
