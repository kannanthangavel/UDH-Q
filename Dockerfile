FROM node:20-slim

WORKDIR /app

# Install native dependencies for better-sqlite3 and Chromium for Puppeteer PDF rendering
RUN apt-get update && apt-get install -y python3 make g++ chromium fonts-noto-core && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node", "backend/src/server.js"]
