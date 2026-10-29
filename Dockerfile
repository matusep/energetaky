FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    DB_PATH=/app/data/app.db

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

VOLUME /app/data
EXPOSE 3000
CMD ["node", "src/server.js"]
