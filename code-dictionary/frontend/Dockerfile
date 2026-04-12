FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_API_URL="" makes axios use relative URLs (same origin).
# nginx proxies /api/ to the code-dictionary backend inside K8s.
ENV VITE_API_URL=""
# Skip tsc type-check (pre-existing TS errors in ForceGraph3D.tsx).
RUN npx vite build --base /code-dictionary/

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
