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
RUN npx vite build --base /

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
