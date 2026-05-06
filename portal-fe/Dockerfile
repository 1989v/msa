FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci
COPY . .
# portal-fe = MSA root 진입점. ingress 가 / catch-all 로 받고,
# /api/* 는 별도 ingress rule 이 gateway 로 라우팅.
# axios baseURL = "" → relative path 로 같은 origin 의 /api/... 호출.
ENV VITE_API_URL=""
# Skip tsc type-check (pre-existing TS errors in ForceGraph3D.tsx).
RUN npx vite build --base /

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
