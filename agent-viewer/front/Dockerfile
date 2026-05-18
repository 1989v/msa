FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
# WebSocket 은 Cloudflare bypass host (rt.<DOMAIN>) 사용해서 CF 100s idle timeout 회피.
# 도메인 변경 시 build-arg 또는 이 Dockerfile 수정.
# 참고: gateway 에 /ws/events → agent-viewer-api 라우트 등록 필요 (별도 작업).
ARG VITE_WS_URL=wss://rt.1989v.com/ws/events
ENV VITE_WS_URL=${VITE_WS_URL}
RUN npx vite build --base /

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
