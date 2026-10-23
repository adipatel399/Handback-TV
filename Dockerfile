FROM node:24-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive PLAYWRIGHT_BROWSERS_PATH=/opt/handback-browsers
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps --only-shell chromium && apt-get update && apt-get install -y --no-install-recommends espeak-ng ca-certificates && rm -rf /var/lib/apt/lists/*
COPY LICENSE THIRD_PARTY_NOTICES.md ./
COPY server ./server
COPY web ./web
COPY tsconfig.json vite.config.ts ./
RUN npm run build && mkdir -p /app/.data && chown -R node:node /app /opt/handback-browsers
USER node
ENV HANDBACK_HOST=0.0.0.0 HANDBACK_PORT=4310 HANDBACK_DATA_DIR=/app/.data NODE_ENV=production
EXPOSE 4310
CMD ["npm", "start"]
