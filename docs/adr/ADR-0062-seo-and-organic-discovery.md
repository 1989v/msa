# ADR-0062 — SEO / 검색 유입 설계 (게임 플랫폼 우선)

- Status: Accepted (2026-08-07)
- Date: 2026-08-07
- Relates: ADR-0058(FE 통합), ADR-0059(게임 플랫폼 · game 서브도메인), ADR-0019(K8s 전환)

## Context

`game.1989v.com` 에 브라우저 게임 28종(PUBLISHED)이 서비스 중이지만 검색 유입 경로가 사실상
막혀 있었다. 실측(2026-08-07, `portal-fe` main):

| 항목 | 상태 |
|---|---|
| 렌더링 | Vite CSR SPA — `index.html` 한 벌, nginx `try_files $uri /index.html` |
| 타이틀 | 전 페이지 동일(`kgd.dev — 풀스택 백엔드 엔지니어 포털`). `document.title` 세팅 코드 0건 |
| 게임 상세 | 제목·설명·평점·태그가 전부 런타임 API — 초기 HTML 에 텍스트 0바이트 |
| robots / sitemap | 없음 |
| 구조화 데이터 | 없음 |
| i18n | `titleEn`/`descriptionEn` 시드는 있으나 `localStorage` 로만 전환 → 영문 콘텐츠에 URL 이 없어 색인 불가 |
| 원시 게임 프레임 | `/games/<slug>/index.html` 이 `<title>` 만 있는 상태로 크롤 가능 → 상세 페이지와 색인 경합 |

구글은 JS 를 실행해 렌더링 후 색인하지만 **네이버(Yeti)·다음(Daumoa)·카카오톡/슬랙/X 언퍼러는
실행하지 않는다**. 국내 게임 검색 유입과 메신저 공유 유입이 통째로 빠지는 구조였다.

## Decision

### 1. 빌드타임 프리렌더 + 런타임 메타 (이중화)

`vite build` 산출물의 `dist/index.html` 을 틀로 삼아 게임 페이지별 정적 HTML 을 찍는다
(`portal-fe/scripts/prerender-seo.mjs`). 자산 태그(`script`/`modulepreload`/`stylesheet`)를
그대로 물려받으므로 SPA 는 정상 부팅하고, React 가 마운트되면 `#root` 본문을 교체한다.

```
dist/prerender/_hosts/game.1989v.com.html   →  game 호스트 루트(허브, ko)
dist/prerender/en/index.html                →  /en (허브, en)
dist/prerender/games/index.html             →  /games
dist/prerender/games/genre/<genre>.html     →  장르 랜딩 9종
dist/prerender/games/<slug>.html            →  게임 상세
dist/prerender/en/games/**                  →  영문 전량
dist/seo/<host>/{robots.txt,sitemap.xml}    →  호스트별 SEO 자산
```

nginx 가 정확히 매칭되는 프리렌더 파일이 있으면 그것을, 없으면 기존처럼 SPA 셸을 준다.
SPA 내부 전환은 `src/seo/useSeo.ts` 훅이 같은 메타를 갱신한다.

**카피는 `src/seo/copy.mjs` 단일 원본**이다. 빌드 스크립트(Node)와 런타임(TS)이 같은 문자열을
만들어야 색인 결과와 탭 타이틀이 어긋나지 않아, TS 가 아닌 순수 JS 로 두고 양쪽에서 import 한다
(`tsconfig.app.json` 의 `allowJs`).

### 2. URL 로 승격하는 상태 — 언어와 장르만

| 상태 | URL 승격 | 근거 |
|---|---|---|
| 언어 | `/games/<slug>` (ko) ↔ `/en/games/<slug>` (en) | 영문 콘텐츠에 주소가 없으면 색인 자체가 불가 |
| 장르 | `/games/genre/puzzle` | "무료 퍼즐게임" 류 카테고리 키워드의 착지점 |
| 정렬(인기/신작/평점) | ✗ | 같은 목록의 재배열 — 중복 콘텐츠 |
| 태그 | ✗ | 장르와 크게 겹쳐 얇은 페이지가 양산됨 |

장르 필터는 `<button>` 에서 `<Link>` 로 바꿨다. 크롤러는 버튼 클릭을 따라가지 못한다.

### 3. canonical 은 `game.1989v.com` 하나로

apex 의 `/games/*` 는 이미 게임 호스트로 리다이렉트하고(ADR-0059), 프리렌더 페이지는 어느
호스트로 서빙되든 canonical 로 게임 호스트를 가리킨다. hreflang 은 ko/en/x-default 3쌍이며
x-default 는 영문 — 비한국어권이 기본 트래픽이라는 판단이다.

### 4. 원시 게임 프레임은 `noindex, follow`

`/games/<slug>/index.html` 은 상세 페이지가 iframe 으로 물고 있는 소스다. 단독 색인되면
설명·평점·내부링크가 없는 얇은 페이지가 상세 페이지와 경합한다. nginx 가 헤더로 막는다
(50개 파일을 각각 고치지 않는다):

```nginx
location ~ ^/games/[a-z0-9][a-z0-9-]*/index\.html$ {
    add_header X-Robots-Tag "noindex, follow";
}
```

robots.txt 에서 `Disallow` 하지 **않는다** — 크롤이 막히면 `noindex` 헤더 자체를 못 읽는다.

### 5. 호스트별 robots / sitemap

portal-fe 한 벌이 `1989v.com` 과 `game.1989v.com` 을 동시에 서빙하므로 `$host` 로 가른다.
sitemap 은 호스트 경계를 넘지 않아야 Search Console 이 그대로 받는다.

```nginx
location = /robots.txt  { try_files /seo/$host/robots.txt /seo/1989v.com/robots.txt =404; }
location = /sitemap.xml { try_files /seo/$host/sitemap.xml =404; }
```

게임 sitemap 은 76 URL(허브 2 + 장르 18 + 상세 56)이며 `lastmod` 는 `contentUpdatedAt`,
각 URL 에 `xhtml:link` hreflang 대체 주소를 붙인다.

### 6. 구조화 데이터

| 페이지 | schema.org |
|---|---|
| 게임 상세 | `VideoGame` (+ 평점이 있으면 `aggregateRating`) + `BreadcrumbList` |
| 허브 / 장르 | `CollectionPage` + `ItemList` (+ 허브는 `WebSite`) |
| 포털 루트 | `WebSite` + `SearchAction` |

`aggregateRating` 은 `ratingCount > 0` 일 때만 넣는다 — 0표에 별점을 선언하면 리치 결과에서
스팸으로 취급된다.

### 7. og:image 는 래스터만

SVG 썸네일은 카카오톡·슬랙·X·페이스북 언퍼러가 렌더하지 못한다. `socialImage()` 가
`png/jpg/webp` 일 때만 `og:image` 를 내보내고, 아니면 `twitter:card=summary`(텍스트 카드)로
떨어뜨린다. 현재 28종 중 래스터 스크린샷 보유는 17종.

## Consequences

- 빌드가 공개 게임 API(`api.1989v.com`)에 의존한다. **fail-soft** — 조회 실패 시 robots/sitemap
  만 남기고 프리렌더를 건너뛴 뒤 성공으로 끝낸다. SEO 자산 때문에 이미지 빌드가 깨지면 안 된다.
- 어드민에서 게임을 추가해도 **다음 portal-fe 배포 전까지 프리렌더에 반영되지 않는다.**
  SPA 로는 즉시 동작하고 구글은 렌더링 후 색인하므로, 네이버/언퍼러 노출만 배포까지 지연된다.
  게임 추가가 잦아지면 sitemap/프리렌더를 백엔드 엔드포인트로 옮기는 것이 다음 단계다.
- `index.html` 의 `<!--seo:start--> … <!--seo:end-->` 마커를 지우면 프리렌더가 조용히 죽는다.
  스크립트가 마커 부재를 에러로 던져 빌드 로그에 남긴다.
- `/en` 이 게임 영역 전용 프리픽스가 됐다. 포털(apex)에는 영문 라우트가 없다.

## Alternatives considered

| 대안 | 기각 사유 |
|---|---|
| 런타임 메타만 (useSeo) | 구글만 커버. 네이버·다음·메신저 언퍼러가 기본 타이틀만 봄 — 유입 목표를 못 채움 |
| 백엔드 SSR shell (`game:feature`) | 항상 최신이지만 FE 빌드 산출물 경로를 백엔드가 알아야 하고 게이트웨이 라우트·ingress 가 얽힘. ADR-0058 의 FE/BE 경계를 깨는 대가가 이득보다 큼 |
| Next.js 등 SSR 프레임워크 전환 | portal-fe 통합(ADR-0058 R3)을 되돌리는 규모. 현재 트래픽에서 정당화 불가 |
| 태그별 랜딩 페이지 | 장르와 중복도가 높아 얇은 페이지 양산 → 사이트 전체 품질 평가에 역효과 |
| 50개 게임 HTML 에 canonical 직접 주입 | 헤더 한 줄로 끝나는 일을 파일 50개 수정으로 처리 — 새 게임마다 반복 비용 |

## 남은 작업 (검색 유입 운영)

코드로 끝나지 않는, 사람이 해야 하는 항목. 영향 큰 순.

1. **검색엔진 등록 + sitemap 제출** — Google Search Console / 네이버 서치어드바이저 /
   Bing Webmaster 에 `game.1989v.com`, `1989v.com` 을 각각 등록하고 sitemap 제출.
   등록 없이는 색인까지 수 주가 걸린다. 네이버는 등록이 사실상 필수.
2. **게임별 1200×630 래스터 스크린샷** — 미보유 11종. 메신저 공유 CTR 이 텍스트 카드 대비
   크게 갈린다. `public/games/thumbs/shots/<slug>.png` 에 넣으면 자동으로 og:image 가 붙는다.
3. **게임 설명 고유성 점검** — `description` 이 짧거나 템플릿에 가까우면 스니펫이 빈약해진다.
   50자 미만이면 프리렌더가 장르 문구를 덧붙이지만, 시드 원문을 채우는 편이 낫다.
4. **영문 카피 채우기** — `title_en` / `description_en` 이 비면 영문 페이지가 한국어로 채워진다.
   영문 검색량이 한국어의 수십 배인 카테고리라 여기 투자 대비가 가장 크다.
5. **Core Web Vitals** — 번들 2MB(gzip 573KB) 단일 청크. 게임 상세 진입 LCP 가 유입 순위에
   직접 걸린다. 라우트 단위 코드 스플릿이 다음 개선점.
6. **외부 링크 확보** — itch.io / Reddit(r/WebGames, r/incremental_games) / 커뮤니티 등록.
   신규 도메인은 백링크 없이는 경쟁 키워드에서 밀린다.
7. **배포 후 검증** — `curl -I https://game.1989v.com/games/<slug>/index.html` 로 X-Robots-Tag,
   Search Console URL 검사로 렌더링 결과와 구조화 데이터, `sitemap.xml` 200 응답 확인.
