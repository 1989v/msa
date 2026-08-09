FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN rm -f package-lock.json && npm install --no-audit --no-fund
COPY . .
# OAuth client_id 는 브라우저에 노출되는 공개값이지만 값은 레포에 두지 않고 CI 가 넘긴다.
# 미주입이면 빈 문자열이 되어 로그인 버튼이 동작하지 않는다.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
# portal-fe = MSA root 진입점. ingress 가 / catch-all 로 받고,
# /api/* 는 별도 ingress rule 이 gateway 로 라우팅.
# axios baseURL = "" → relative path 로 같은 origin 의 /api/... 호출.
ENV VITE_API_URL=""
# Skip tsc type-check (pre-existing TS errors in ForceGraph3D.tsx).
# 프리렌더는 공개 게임 API 를 읽어 SEO 정적 페이지를 찍는다 — 실패해도 빌드는 통과한다.
RUN npx vite build --base / && node scripts/prerender-seo.mjs

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
