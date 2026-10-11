# 배포 · 운영 확인 — TG5.3 · TG5.5

2026-10-11 12:29~12:35 KST. 운영 조회는 공개 `curl` 과 `ssh msa-oci` 읽기만 했다(로컬 kubectl 없음).

## 재는 대상이 최신인지

- `ssh msa-oci` 배포 이미지: `portal-fe:4b9a5bf` · `search:4b9a5bf` · `search-consumer:4b9a5bf` (파드 기동 13~21분 전)
- 이번에 새로 생긴 것이 응답에 있다: `sitemap.xml` 첫 항목이 `sitemap-places-core.xml`, `/en/attractions/1` 이 301 — 옛 번들이면 둘 다 없다

## TG5.3 — 전 그룹 검증 재실행 (워크트리, HEAD a0b26c69f)

```
$ cd portal-fe && npx vitest run src/seo/__tests__/prerenderPlace.test.ts src/seo/__tests__/prerenderPlaceLandings.test.ts \
    src/seo/__tests__/prerenderGuides.test.ts src/seo/__tests__/prerenderPortalHome.test.ts \
    src/seo/__tests__/footerLinksGolden.test.ts src/pages/place/__tests__/AttractionPage.test.tsx
 ✓ prerenderPortalHome 2 · footerLinksGolden 3 · prerenderGuides 9 · prerenderPlaceLandings 26 · prerenderPlace 57 · AttractionPage 88
 Test Files  6 passed (6)
      Tests  185 passed (185)                      (exit 0)

$ bash portal-fe/scripts/check-nginx-place-landings.sh      (실제 nginx:1.27-alpine)
 ok 62줄 · FAIL 0 · 마지막 「⑧ 핵심 sitemap — ok /sitemap-places-core.xml 200」 · PASSED   (exit 0)

$ ./gradlew :search:app:test --rerun --tests '*AttractionPageServiceTest' --tests '*AttractionPageControllerTest'
 AttractionPageServiceTest tests=9 failures=0 · AttractionPageControllerTest tests=18 failures=0
 BUILD SUCCESSFUL in 7s
```

TG1.6 · TG2.5(`prerenderPlace`) · TG3.5(랜딩·편집·홈·푸터 + nginx 계약) · TG4.5(서버 두 스위트 + `AttractionPage`)가 위 세 명령에 모두 들어 있다.

## TG5.5 — 운영 확인

| 확인 | 기대 | 실제 | 판정 |
|---|---|---|---|
| `sitemap.xml` 색인 순서 | core 첫째 · 행사 마지막 | core → 1 → 2 → 3 → events | 통과 |
| `/sitemap-places-hub.xml` | 404 | `HTTP/2 404` | 통과 |
| core URL 수 | ≈ 19,500 (±5%) | 19,538 (허브 항목 541 · 티어 A 상세 18,997) | 통과 |
| 정적 sitemap `<loc>` 합 = 빌드 로그 N + 허브 항목 | 정확히 일치 | 19,538 + 20,000 + 20,000 + 3,987 = **63,525** = 62,984 + 541 | 통과 |
| core 티어 A 상세 = 빌드 로그 티어 A | 정확히 일치 | 18,997 = ko 16,968 + en 2,029 | 통과 |
| 정적 sitemap 사이 중복 `<loc>` | 0 | 0 | 통과 |
| `/regions/11110/free` | `x-robots-tag: noindex, follow` | 200 · `x-robots-tag: noindex, follow` · `cache-control: no-cache, must-revalidate` | 통과 |
| `/en/attractions/1` | 301 · `location: /attractions/1` · `cache-control: no-cache, must-revalidate` | 그대로 | 통과 |
| `/attractions/21` | 301 · `location: /en/attractions/21` | 301 · `location: /en/attractions/21` · `cache-control: no-cache, must-revalidate` | 통과 |
| `/attractions/1` | 200 | 200 · `x-render: ssr` | 통과 |
| `/prerender/_noindex/regions/11110/free.html` | 404 | `HTTP/2 404` | 통과 |
| `/regions/11110` 의 `href="/attractions/…"` | ≥ 1 | 10 (영문 `/en/regions/11110` 의 `/en/attractions/…` 도 10) | 통과 |
| `llms.txt` 의 `/regions/{n}/` · `/guides` 줄 | 0 | 0 | 통과 |
| apex `1989v.com/` 의 `place.1989v.com/regions/11` | 1 | 1 — `<a href="https://place.1989v.com/regions/11">서울 가볼 만한 곳</a>` | 통과 |

빌드 로그 원문(images run 38105740625, portal-fe 이미지 빌드 단계, 2026-10-11 12:05 KST):

```
[seo] place sitemap 62984 URL · 정적 4 파일 + 행사 동적 1
[seo] place core 티어 A ko 16968건 · en 2029건
[seo] place 티어 A 중 깊이 3 안 ko 2546/16968 · en 1429/2029
```

N(62,984)은 상세만 센다. 정적 파일 상세 합(core 18,997 + 20,000 + 20,000 + 3,987 = 62,984)과 같고, 허브 항목 541 은 core 에만 있다(허브·영문 허브 각 1 · 지역 국문 273 · 영문 266). 행사 sitemap(550 URL)은 search 가 요청 때 만들어 N 에 들지 않는다.

참고: 「티어 A 중 깊이 3 안」은 ko 15% · en 70% 다. 시군구 대표 10곳이 닿게 한 몫이고, 전체 티어 A 의 3클릭 도달은 범위 밖(Q11 — 정적 목록 페이지네이션)이다.

## 사용자 몫 (Search Console)

- [ ] Q14 · Q7: GSC 「페이지」 보고서 sitemap 필터에서 `sitemap-places-core.xml` 을 따로 고를 수 있는지. 안 되면 `sitemap-places-core.xml` 하나만 개별 제출한다(Q7 「sitemap.xml 만」의 예외).
- [ ] GSC 에 `sitemap-places-hub.xml` 이 개별 제출돼 있는지 — 있으면 지운다(지금 404 다).
