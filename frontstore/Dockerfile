# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS development
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
# Rewrites in next.config.js are resolved at build time, so the internal
# service URLs must be set before `npm run build`. Defaults match compose.
ARG INTERNAL_API_BASE_URL=http://backend:8080
ARG INTERNAL_BACKOFFICE_URL=http://backoffice:5173
ENV INTERNAL_API_BASE_URL=$INTERNAL_API_BASE_URL \
    INTERNAL_BACKOFFICE_URL=$INTERNAL_BACKOFFICE_URL
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM base AS production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
