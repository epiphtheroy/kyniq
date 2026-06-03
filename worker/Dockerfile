FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production stage ──
FROM node:22-alpine

WORKDIR /app

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled JS
COPY --from=builder /app/dist ./dist

# Health check port
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
