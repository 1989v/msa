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
# 카카오도 같은 공개값이다. 이 줄이 없어 지금까지 client_id 가 빈 문자열로 빌드됐고
# 카카오 로그인이 KOE101(앱 관리자 설정 오류)로 막혀 있었다 — 컨테이너 빌드 전체에서.
ARG VITE_KAKAO_CLIENT_ID=""
ENV VITE_KAKAO_CLIENT_ID=$VITE_KAKAO_CLIENT_ID
# Google Maps JS 키 (ADR-0065 /tour) — 공개값, referrer 제한+쿼터 캡으로 보호.
# 미주입이면 /tour 는 지도 없이 리스트-only 폴백.
ARG VITE_GOOGLE_MAPS_KEY=""
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY
# portal-fe = MSA root 진입점. ingress 가 / catch-all 로 받고,
# /api/* 는 별도 ingress rule 이 gateway 로 라우팅.
# axios baseURL = "" → relative path 로 같은 origin 의 /api/... 호출.
ENV VITE_API_URL=""
# Skip tsc type-check (pre-existing TS errors in ForceGraph3D.tsx).
# 프리렌더는 공개 게임 API 를 읽어 SEO 정적 페이지를 찍는다 — 실패해도 빌드는 통과한다.
RUN npx vite build --base / && node scripts/prerender-seo.mjs
# 게임 JS minify — 서빙물에서 원문 가독성 제거 (소스맵 미발행). 인라인 스크립트 HTML 게임은
# 55종 일괄 회귀 위험 대비 이득이 작아 제외 — 수익 티어(다중 파일) 게임과 공용 lib 만.
# Unity 산출물(Build/)은 제외한다 — 엔진이 낸 코드라 이미 최소화돼 있고, 5MB 짜리를
# 다시 파싱하면 이미지 빌드만 길어진다. .gz 는 애초에 -name '*.js' 에 안 걸린다.
RUN find dist/games -name '*.js' -type f -not -path '*/Build/*' | while read f; do \
      node_modules/.bin/esbuild "$f" --minify --charset=utf8 --outfile="$f" --allow-overwrite --log-level=error || exit 1; \
    done
# 공용 lib 참조에 빌드 지문을 찍는다. 게임 자산은 파일명에 해시가 없어 URL 이 고정인데,
# Cloudflare 가 오리진의 no-cache 를 자기 Browser Cache TTL(4h)로 덮어써서 배포해도
# 기존 방문자는 최대 4시간 동안 구버전 lib 를 계속 썼다. 게임 HTML 은 no-cache 가 지켜지므로
# (cf-cache-status: DYNAMIC) 참조 URL 만 바뀌면 그 즉시 새 파일을 받는다.
# 이미 ?v=N 이 손으로 붙어 있는 참조가 섞여 있으므로(keys/platform/rank) 먼저 그것부터 갈아친다.
ARG GIT_SHA="dev"
RUN find dist/games -name '*.html' -type f -exec \
      sed -i -e "s#\(\.\./lib/[a-z0-9_.-]*\)?v=[^\"]*\"#\1?v=${GIT_SHA}\"#g" \
             -e "s#\(\.\./lib/[a-z0-9_-]*\.js\)\"#\1?v=${GIT_SHA}\"#g" \
             -e "s#\(\.\./lib/[a-z0-9_-]*\.css\)\"#\1?v=${GIT_SHA}\"#g" {} + \
 && grep -q 'lib/touch\.js?v=' dist/games/overworld-quest/index.html
# 산출물 HTML 주석 제거 — 반드시 마지막이다. index.html 주석은 미니파이 대상이 아니라
# 내부 설계 메모가 그대로 배포된다. 프리렌더의 seo 마커 교체와 위 sed 가 끝난 뒤 돈다.
RUN node scripts/strip-html-comments.mjs

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
