FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json turbo.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

COPY backend ./backend

RUN npx prisma generate --schema=backend/prisma/schema.prisma
RUN npm run build --workspace backend

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json turbo.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

WORKDIR /app/backend
EXPOSE 3002

CMD ["node", "dist/server.js"]
