# ADR-0062 — SEO / AEO / 검색 유입 설계 (전 호스트)

- Status: Accepted (2026-08-07, 2026-08-19 place·포털·AEO 로 확장, 2026-08-22 §8 개정 — 상세 선별 프리렌더)
- Date: 2026-08-07
- Relates: ADR-0058(FE 통합), ADR-0059(게임 플랫폼), ADR-0064(이력서 게이트), ADR-0065(K-관광), ADR-0066(서비스 런처), ADR-0019(K8s 전환)

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
dist/prerender/_hosts/<host>[.en].html       →  호스트별 루트 (게임 허브 / place 허브 / 포털)
dist/prerender/{tech,portfolio,shop}.html    →  apex 정적 페이지
dist/prerender/games/index.html              →  /games
dist/prerender/games/genre/<genre>.html      →  장르 랜딩 9종
dist/prerender/games/<slug>.html             →  게임 상세
dist/prerender/en/games/**                   →  게임 영문 전량
dist/prerender/(en/)?attractions/<id>.html   →  관광지 상세 — 개요 있는 문서만, 상한 아래 (§8 개정)
dist/prerender/(en/)?regions/<code>.html     →  지역 상세 양언어 (§8 개정)
dist/seo/<host>/robots.txt                   →  호스트별 크롤 정책
dist/seo/<host>/sitemap*.xml                 →  호스트별 sitemap (place 는 인덱스 + 분할)
dist/seo/<host>/llms.txt                     →  호스트별 AEO 진입 문서
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

이 블록들에는 **`Cache-Control` 을 반드시 명시한다.** 비워 두면 Cloudflare 가 기본 4시간을
붙여, 배포가 끝난 뒤에도 엣지가 옛 robots 를 계속 내보낸다. 2026-08-20 deal 호스트를 새로
붙였을 때 `cf-cache-status: HIT` · `age: 1979` 로 apex 폴백 robots 가 계속 나갔고, PoP 마다
캐시 나이가 달라 응답이 요청마다 갈리는 바람에 파드 혼재로 오진했다. 크롤러가 자주 읽는
파일이 아니라 짧은 TTL(300s)의 비용은 사실상 없다.

게임 sitemap 은 142 URL(허브 2 + 장르 18 + 상세 122, 2026-08-19 기준 61종 × 2언어)이며 `lastmod` 는 `contentUpdatedAt`,
각 URL 에 `xhtml:link` hreflang 대체 주소를 붙인다.

### 6. 구조화 데이터

| 페이지 | schema.org |
|---|---|
| 게임 상세 | `VideoGame` (+ 평점이 있으면 `aggregateRating`) + `BreadcrumbList` |
| 게임 허브 / 장르 | `CollectionPage` + `ItemList` (+ 허브는 `WebSite`) |
| 관광지 상세 | `TouristAttraction` (+ `PostalAddress` · `GeoCoordinates`) + `BreadcrumbList` |
| place 허브 | `CollectionPage` |
| 포털 루트 | `WebSite` + `SearchAction` |

`CollectionPage` 는 소속 사이트를 인자로 받는다 — 기본값(게임)이 새면 place 페이지가
`kgd Games` 소속으로 선언된다.

`aggregateRating` 은 `ratingCount > 0` 일 때만 넣는다 — 0표에 별점을 선언하면 리치 결과에서
스팸으로 취급된다.

### 7. og:image 는 래스터만

SVG 썸네일은 카카오톡·슬랙·X·페이스북 언퍼러가 렌더하지 못한다. `socialImage()` 가
`png/jpg/webp` 일 때만 `og:image` 를 내보내고, 아니면 `twitter:card=summary`(텍스트 카드)로
떨어뜨린다. place 의 관광지 사진은 TourAPI 원본(jpg)이라 그대로 쓴다.

### 8. place — 상세는 sitemap 전용, 프리렌더하지 않는다 (2026-08-19)

관광지는 국문 44,911건 · 영문 14,658건, 합계 **59,569 URL** 이다(무필터 조회의 10,000 은
OpenSearch 집계 상한이고 실제 규모가 아니다). 전량 프리렌더하면 9KB × 6만 = 540MB 가 이미지에
들어가 OCI 무료 범위 제약과 정면으로 부딪히고, 국문의 85% 는 개요가 없어 제목·주소뿐인 얇은
페이지가 대량 생긴다. 그래서 상세는 **라우트(`/attractions/:id`) + `useSeo` + sitemap** 으로만
연다. 구글은 렌더링 후 색인하고, 네이버·언퍼러는 상세를 못 보지만 그 손실을 감수한다.

- 정규 주소: `place.1989v.com/attractions/{id}` · 영문 `place.1989v.com/en/attractions/{id}`
  (경로에 `attractions` 를 남겨 영문 키워드를 URL 에 싣는다)
- **hreflang 을 걸지 않는다.** TourAPI 가 국문/영문을 별도 콘텐츠로 관리해 같은 장소라도
  id·contentId 가 다르다(경복궁 ko 126508 / en 264337). 짝을 알 수 없으므로 잘못된 대체 주소를
  선언하느니 생략한다. 허브(`/` ↔ `/en`)만 진짜 번역쌍이라 거기에만 붙인다
- 문서의 `lang` 필드가 SEO 기준이다 — `/en/attractions/{국문id}` 처럼 어긋난 주소가 들어와도
  canonical 이 올바른 쪽을 가리킨다
- 열거는 지역코드 17개로 잘라 훑는다. 무필터는 상위 10,000 에서 잘리고 페이지 크기는 서버가
  100 으로 고정한다. 약 600회 요청 · 100초. 실패한 조각은 건너뛴다 — 일부가 빠진 sitemap 이
  sitemap 이 없는 것보다 낫다
- sitemap 은 파일당 20,000 URL 로 쪼개고 `sitemap.xml` 을 인덱스로 둔다(상한 50,000)
- 검색 목록 카드는 `<article onClick>` 에서 **`<a href>`** 로 바꿨다. 크롤러는 onClick 을
  따라가지 못하고, sitemap 에만 있고 내부 링크가 없는 URL 은 잘 크롤되지 않는다

**개정 (2026-08-22) — 개요 있는 상세만 선별 프리렌더한다.** "전량 프리렌더 금지"의 근거
두 가지(용량, 얇은 페이지) 는 개요 있는 문서에는 해당하지 않고, JS 를 실행하지 않는 AEO
크롤러(GPTBot·ClaudeBot·PerplexityBot — robots 에서 명시적으로 열어 둔)는 프리렌더 없이는
본문을 영영 못 본다. 그래서:

- **관광지 상세**: 개요(`overview`) 있는 문서만, 사진 있는 쪽 우선, 언어당
  `SEO_PLACE_DETAIL_CAP`(기본 3,000 — 최악 ~9KB×6,000 ≈ 54MB) 아래에서
  `dist/prerender/(en/)?attractions/<id>.html` 로 찍는다. 메타 + `TouristAttraction`
  (+`alternateName`=원어 병기명) + breadcrumb + 읽히는 본문(h1·주소·개요·지역/주변 링크).
  개요 없는 나머지는 원 결정대로 sitemap 전용이다. hreflang 없음도 그대로다
- **지역 상세**: 건수>0 지역 전부 양언어(`(en/)?regions/<code>.html`). `TouristDestination`
  + 시군구/대표 관광지 내부 링크. hreflang 은 양언어에 실재하는 코드만 (sitemap 과 동일 규칙)
- **키는 경로다, `_hosts` 가 아니다** — §9 의 호스트 키는 호스트마다 내용이 갈리는 `/`·`/en`
  의 것이고, `/attractions/*`·`/regions/*` 는 어느 호스트로 오든 같은 place 콘텐츠에
  canonical 이 place 호스트를 가리킨다. nginx 는 프리렌더 파일을 먼저 찾고 없으면 SPA 폴백
  (`portal-fe/nginx.conf` 의 attractions|regions location)
- **열거 축을 구 areaCode → 법정동 sidoCode 로 교체.** 구 코드는 폐기 중이라 문서의 ~43% 에서
  비어 그 축의 샤딩은 그만큼을 sitemap 에서 누락시켰다. 시도 17개 정적 목록으로 훑는다
  (ADR-0071 의 지역 축과 일치, 10,000건 창 회피는 동일)

### 9. `/en` 은 호스트로 가른다 (2026-08-19)

`location = /en` 이 호스트를 보지 않아 **place 영문 홈에 게임 허브 프리렌더가 나가고 있었다** —
canonical 까지 `game.1989v.com/en` 을 가리켜 place 영문 페이지가 통째로 오색인됐다. 루트(`/`)와
같은 규칙으로 `_hosts/$host.en.html` 을 먼저 찾게 고쳤다.

한 벌의 번들이 4개 호스트를 서빙하는 구조에서는 **호스트로 갈리는 경로마다 프리렌더도 호스트
키를 가져야 한다**. 경로만 보고 파일을 고르면 다른 서비스의 페이지가 새어 나간다.

### 10. AEO — llms.txt + AI 크롤러 명시 (2026-08-19)

답변형 검색에 인용되는 쪽이 이득이라고 보고 명시적으로 연다. robots.txt 에 GPTBot ·
OAI-SearchBot · ChatGPT-User · ClaudeBot · Claude-User · PerplexityBot · Google-Extended ·
Applebot-Extended 를 `Allow` 로 적는다 (기본 `*` 로도 열리지만, 의도를 기록으로 남긴다).

호스트마다 `/llms.txt` 를 둔다 — 게임은 전체 목록과 장르, place 는 데이터 규모·주소 형식·공개
API, 포털은 서비스 목록. **전량 열거는 sitemap 이 하고 llms.txt 는 "무엇을 어디서 보면 되는지"만**
짧게 적는다. 이력서 호스트는 llms.txt 도 sitemap 도 두지 않는다 (ADR-0064).

### 11. deal — 색인은 막되 크롤은 연다 (2026-08-20)

혜택 링크 허브는 P1 에서 색인 대상이 아니다 (ADR-0069 §6 — 링크 모음만 있는 상태로 색인되면
thin affiliate 판정을 자초하고 그 평가가 사이트 전체에 번진다). 다만 **막는 방식이 중요하다.**

robots.txt 로 크롤을 막으면 안 된다. 크롤러가 `noindex` 를 읽지 못해 URL 만 색인되고,
카카오톡·슬랙·X 언퍼러가 OG 카드를 못 만든다. 이 페이지의 유입은 SNS 공유라 OG 카드가 곧
트래픽이다. 그래서 **크롤은 열고 색인만 세 겹으로 막는다.**

| 계층 | 수단 |
|---|---|
| 응답 헤더 | nginx `map $host $host_robots_tag` → `noindex, follow` |
| HTML | 프리렌더가 `<meta name="robots" content="noindex, follow">` 를 심는다 |
| 런타임 | `dealHubMeta()` 의 `noindex: true` 를 `useSeo` 가 적용 |

헤더 하나에 걸어두면 프록시 한 단만 잘못 끼어도 사라지는데, 색인은 한 번 뚫리면 되돌리는 데
몇 주가 걸린다. 되돌리기 비용이 비대칭이면 중복이 낭비가 아니다.

**아웃바운드 리다이렉터 `/go/{slug}` 는 별도로 막는다.** robots.txt 의 `Disallow: /go/` 를
무시하는 수집기가 있고, 공유되는 주소라 외부에서 발견되기도 쉽다. 색인되면 제휴 트래킹 URL 이
검색결과에 노출되고 302 를 따라간 링크 신호가 제휴사로 넘어가므로, 응답에
`X-Robots-Tag: noindex, nofollow` 를 직접 붙인다 (`DealRedirectController`). 이 경로는 ingress 가
gateway 로 보내 portal-fe nginx 를 거치지 않으므로 헤더를 백엔드가 붙여야 한다.

sitemap 과 llms.txt 는 두지 않는다 — 색인하지 않기로 한 면을 답변형 검색에 밀어 넣는 것은
모순이다. P2 에서 오퍼별 콘텐츠가 붙으면 세 계층을 한꺼번에 푼다.

## Consequences

- 빌드가 공개 게임 API(`api.1989v.com`)에 의존한다. **fail-soft** — 조회 실패 시 robots/sitemap
  만 남기고 프리렌더를 건너뛴 뒤 성공으로 끝낸다. SEO 자산 때문에 이미지 빌드가 깨지면 안 된다.
- 어드민에서 게임을 추가해도 **다음 portal-fe 배포 전까지 프리렌더에 반영되지 않는다.**
  SPA 로는 즉시 동작하고 구글은 렌더링 후 색인하므로, 네이버/언퍼러 노출만 배포까지 지연된다.
  게임 추가가 잦아지면 sitemap/프리렌더를 백엔드 엔드포인트로 옮기는 것이 다음 단계다.
- `index.html` 의 `<!--seo:start--> … <!--seo:end-->` 마커를 지우면 프리렌더가 조용히 죽는다.
  스크립트가 마커 부재를 에러로 던져 빌드 로그에 남긴다.
- `/en` 은 호스트마다 다른 서비스의 영문 면이다 (게임 허브 / place 허브). 포털(apex)에는 영문 면이
  없어 게임 영문 허브로 폴백하고, canonical 이 게임 호스트를 가리킨다.
- 빌드가 관광지 열거로 100초 늘었다. 실패해도 fail-soft 라 이미지 빌드는 통과한다.
- 관광지가 늘어도 재배포 전까지 sitemap 에 반영되지 않는다 — 게임과 같은 성질의 지연이다.
- SEO 자산 총량은 6MB (place sitemap 3파일 6MB 가 대부분). 프리렌더 HTML 은 149장 1.8MB.

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
   Bing Webmaster 에 `game.1989v.com`, `place.1989v.com`, `1989v.com` 을 각각 등록하고
   sitemap 제출 (place 는 인덱스 하나만 내면 분할본까지 따라간다).
   등록 없이는 색인까지 수 주가 걸린다. 네이버는 등록이 사실상 필수.
2. **deal 허브 OG 이미지** — 유입이 SNS 공유인데 `og:image` 가 없어 텍스트 카드로 나간다.
   색인을 막아둔 P1 에서는 카드 품질이 사실상 유일한 유입 변수다 (ADR-0069 §6).
3. **게임별 1200×630 래스터 스크린샷** — 미보유 11종. 메신저 공유 CTR 이 텍스트 카드 대비
   크게 갈린다. `public/games/thumbs/shots/<slug>.png` 에 넣으면 자동으로 og:image 가 붙는다.
4. **게임 설명 고유성 점검** — `description` 이 짧거나 템플릿에 가까우면 스니펫이 빈약해진다.
   50자 미만이면 프리렌더가 장르 문구를 덧붙이지만, 시드 원문을 채우는 편이 낫다.
5. **영문 카피 채우기** — `title_en` / `description_en` 이 비면 영문 페이지가 한국어로 채워진다.
   영문 검색량이 한국어의 수십 배인 카테고리라 여기 투자 대비가 가장 크다.
6. **Core Web Vitals** — 번들 2MB(gzip 573KB) 단일 청크. 게임 상세 진입 LCP 가 유입 순위에
   직접 걸린다. 라우트 단위 코드 스플릿이 다음 개선점.
7. **외부 링크 확보** — itch.io / Reddit(r/WebGames, r/incremental_games) / 커뮤니티 등록.
   신규 도메인은 백링크 없이는 경쟁 키워드에서 밀린다.
8. **배포 후 검증** — `curl -I https://game.1989v.com/games/<slug>/index.html` 로 X-Robots-Tag,
   Search Console URL 검사로 렌더링 결과와 구조화 데이터, `sitemap.xml` 200 응답 확인.
