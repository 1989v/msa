FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN rm -f package-lock.json && npm install --no-audit --no-fund
COPY . .
# SSE 는 Cloudflare bypass host (rt.<DOMAIN>) 사용해서 CF 100s timeout + 버퍼링 회피.
# 도메인 변경 시 build-arg 또는 이 Dockerfile 수정.
ARG VITE_SSE_BASE_URL=https://rt.1989v.com
ENV VITE_SSE_BASE_URL=${VITE_SSE_BASE_URL}
RUN npx vite build --base /

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
