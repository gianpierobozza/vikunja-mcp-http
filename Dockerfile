FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4010
ENV VERIFY_SSL=true

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 4010

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "const http = require('node:http'); const port = Number(process.env.PORT || 4010); const req = http.get({ host: '127.0.0.1', port, path: '/healthz', timeout: 4000 }, (res) => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('timeout', () => { req.destroy(new Error('timeout')); process.exit(1); }); req.on('error', () => process.exit(1));"

CMD ["node", "dist/server.js"]
