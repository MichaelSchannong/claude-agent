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

CMD ["node", "src/server.js"]
