# ── Node.js API – Dockerfile ──────────────────────────────
FROM node:20-slim

ENV NODE_ENV=production TZ=Europe/Copenhagen

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates tzdata \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/
RUN mkdir -p /app/data /app/logs

HEALTHCHECK --interval=30s --timeout=5s \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
