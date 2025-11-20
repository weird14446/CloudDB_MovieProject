FROM node:25-alpine AS base
WORKDIR /app
RUN npm install -g npm@11.6.3

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/next.config.mjs ./next.config.mjs

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
