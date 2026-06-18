# ---- builder: compile backend + build the React SPA ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Backend deps (cached on package*.json)
COPY package.json package-lock.json ./
RUN npm ci

# Client deps (cached on client/package*.json)
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# Sources, then build both (nest build -> dist/, vite build -> client/dist/)
COPY . .
RUN npm run build && cd client && npm run build

# ---- runtime: prod deps + built artifacts only ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled server (incl. ruleset JSON assets) and the built SPA
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3000
CMD ["node", "dist/main"]
