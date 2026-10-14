FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate
RUN npm run build

FROM build AS migrations
WORKDIR /app/server
CMD ["./node_modules/.bin/prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/server/prisma ./server/prisma
RUN mkdir -p /var/lib/mofaic/documents && chown node:node /var/lib/mofaic/documents
USER node
EXPOSE 3000
CMD ["node", "server/dist/src/server.js"]
