# ---- Dependencies stage ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://placeholder.supabase.co}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-placeholder}
ENV SUPABASE_URL=${SUPABASE_URL:-https://placeholder.supabase.co}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-placeholder}
ENV LLM_API_KEY=${LLM_API_KEY:-placeholder}

ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN npm run build

# ---- Production stage ----
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Include scraper and its dependencies for cron jobs
COPY --from=builder --chown=nextjs:nodejs /app/scraper.js ./
COPY --from=builder --chown=nextjs:nodejs /app/http-proxy-utils.js ./
COPY --from=builder --chown=nextjs:nodejs /app/llm-gateway.js ./

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]