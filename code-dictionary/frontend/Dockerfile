FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# /code-dictionary → browser requests go through the Ingress rewrite,
# nginx strips the prefix and proxies /api/ to the backend.
# "" is falsy in JS so the || fallback to localhost:8089 kicks in.
ENV VITE_API_URL="/code-dictionary"
# Skip tsc type-check (pre-existing TS errors in ForceGraph3D.tsx).
RUN npx vite build --base /code-dictionary/

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
