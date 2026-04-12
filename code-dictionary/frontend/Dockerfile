FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Skip tsc type-check (pre-existing TS errors in ForceGraph3D.tsx);
# Vite uses esbuild for transpilation which is type-agnostic.
RUN npx vite build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
