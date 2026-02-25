# syntax=docker/dockerfile:1

# Base image
FROM node:24.0-alpine AS base
WORKDIR /usr/src/app

# Install dependencies (cached)
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Build application
FROM base AS build
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Production runtime image
FROM node:24-alpine AS final
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Run as non-root user
USER node

COPY package*.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/.next ./.next
COPY --from=build /usr/src/app/public ./public
# If you use next.config.ts at runtime, also copy it:
# COPY --from=build /usr/src/app/next.config.* ./

EXPOSE 3000

CMD ["npm", "run", "start"]
