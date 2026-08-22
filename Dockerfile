# EasyCake — imagen de produccion
#
# Multi-stage: Next necesita un paso de build, y con `output: standalone` el
# resultado es un servidor autocontenido con solo las dependencias trazadas.
# La imagen final no lleva ni el codigo fuente ni las devDependencies.

# ── 1. dependencias ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── 2. build ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# No se necesita la base de datos para compilar: todas las paginas son
# dinamicas (force-dynamic), asi que Next no intenta prerenderizar nada que
# consulte Postgres.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 3. runtime ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios: el contenedor no necesita root para nada.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# El servidor standalone ya trae su propio node_modules trazado (pg, bcryptjs).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migraciones y arranque: se aplican solas en cada deploy.
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start.mjs ./scripts/start.mjs

USER nextjs
EXPOSE 3000

CMD ["node", "scripts/start.mjs"]
