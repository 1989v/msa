# AMP ARENA — 서버 + 정적 클라 한 이미지. `docker build -t amp-arena . && docker run -p 8787:8787 amp-arena`
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/shared/src ./shared/src
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/client/dist ./client/dist
EXPOSE 8787
USER node
CMD ["node", "server/src/index.ts"]
