# Use Node.js 22.12.0 (exact version required by Prisma 7.1.0)
FROM node:22.12.0-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Required for Prisma to generate client
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (needs DATABASE_URL for schema validation)
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Verify build output exists
RUN ls -la .next/standalone/ && ls -la .next/static/ && ls -la public/

# Verify scripts directory exists
RUN ls -la scripts/ && test -f scripts/start.sh && echo "start.sh found"

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone build contents (not the directory itself)
# This extracts server.js and .next/ to /app root
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/. ./

# Copy static files (standalone doesn't include these by default)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema and migrations for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Copy startup script (copy from source, not from standalone build)
# Ensure scripts directory exists first
RUN mkdir -p /app/scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start.sh /app/scripts/start.sh

# Verify script exists and make it executable
RUN test -f /app/scripts/start.sh && chmod +x /app/scripts/start.sh && echo "start.sh copied and made executable" || (echo "ERROR: start.sh not found!" && exit 1)

USER nextjs

EXPOSE 10000

ENV PORT=10000
ENV HOSTNAME="0.0.0.0"

# Use sh to execute the script for better compatibility
CMD ["sh", "/app/scripts/start.sh"]

