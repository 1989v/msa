# Engineer Review — architecture (3라운드, 마지막)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md`(2라운드 심판 E0~E12 반영본). 범위는 E4·E6 으로 바뀐 두 구조다. 하나는 `TRUST_LINKS {path,label,labelEn}` 하나에서 상대 주소와 절대 주소가 갈리는 구조이고, 다른 하나는 런타임 Footer 가 그 상수를 읽는 구조다. 이미 판정된 항목은 다시 열지 않는다.

## Seed Discovery
- 스펙, `context/engineer-review-architecture-round2.md`, `context/review-verdict-round2.md`
- 코드 대조
  - `portal-fe/src/components/Footer.tsx:1-62`
  - `portal-fe/scripts/prerender-seo.mjs:454-478`(`SITE_LINKS`·`siteFooter`·`shellBody`, `<footer` 는 :473 한 곳뿐)
  - `portal-fe/src/seo/copy.mjs:19,399`(`PORTAL_ORIGIN`·`PLACE_ORIGIN`)
  - `portal-fe/src/App.tsx:244-249`(`/privacy`·`/about`·`/contact` 라우트가 호스트 분기 밖에 있음)
  - `portal-fe/nginx.conf:135-149`(방침·소개·연락처는 어느 호스트에서든 프리렌더 파일을 그 자리에서 냄)
  - `search/.../AttractionPageRenderer.kt:68,88,647-663`(Found·404 둘 다 같은 `shellBody` 바닥글)
- `.tsx` 가 `seo/copy.mjs` 를 import 하는 선례: `App.tsx:4`, `AdSlot.tsx:2` 외 다수

## 확인 결과

| 대상 | 판정 | 근거 |
|---|---|---|
| 하나의 원본에서 상대·절대 주소가 갈림 | 맞음 | 런타임 Footer 는 `path` 를 그대로 쓰고(SR-2.4, `spec.md:26`), 프리렌더는 `${PORTAL_ORIGIN}${path}` 를 쓴다(SR-2.1, `spec.md:23`). 상대 경로가 성립하는 조건은 둘이다. 하나는 SPA 라우트가 호스트 분기 밖에 있는 것이다(`App.tsx:246-249`). 다른 하나는 nginx 가 어느 호스트에서든 프리렌더를 그 자리에서 내는 것이다(`nginx.conf:145`). SR-1.1 이 `/data-sources` 를 같은 정규식과 라우트 옆에 넣으므로 넷째 링크도 같은 조건을 만족한다. 초기 HTML 은 apex 절대 주소라 호스트 독립이다. 두 주소 형태의 차이는 `Footer.tsx:45-46` 주석의 이유 그대로 유지된다 |
| Footer 가 상수를 읽음 | 맞음 | 리터럴 사본 셋이 둘로 준다. `TRUST_LINKS` 는 FE 의 원본이고, Kotlin 사본은 골든으로 묶인다. `labelEn` 은 Footer 에서만 쓰지만 같은 항목의 화면 라벨이라 따로 둘 이유가 없다 |
| 삭제 테스트 — `TRUST_LINKS` | 제 몫을 함 | 지우면 Footer·`siteFooter` 두 호출자로 흩어진다 |
| 삭제 테스트 — Kotlin 신뢰 링크 함수 | 제 몫을 함 | JVM 은 `.mjs` 를 못 읽는다. `siteLinks()`(`AttractionPageRenderer.kt:656`)와 같은 꼴의 사본이고, 골든 대조가 묶는다 |
| 레이어·의존 방향 | 문제 없음 | 바닥글은 infrastructure 렌더러 안에 있고 ETag 는 presentation 이다. 새 의존은 Footer → `copy.mjs` 하나이고, 이미 있는 방향이다 |
| 바닥글 단일 출처 | 문제 없음 | 프리렌더 `<footer` 는 `siteFooter()` 한 곳이다(`prerender-seo.mjs:473`). Kotlin 은 Found·404 가 같은 `shellBody` 를 탄다(`AttractionPageRenderer.kt:68,88`). 그래서 4링크를 빠뜨리는 다른 경로가 없다. 맨 셸 경로는 Out of Scope 에 이미 적혀 있다 |

## 체크리스트

| 항목 | 판정 |
|---|---|
| 레이어 책임 분리 / 상향 의존 / 순환 | OK |
| 외부 연동 Port / 트랜잭션 | 해당 없음 |
| 모듈 경계 변경 근거 | OK (`spec.md:18`) |
| 패턴 일관성 | OK (`SITE_LINKS` 옆 상수, `copy.mjs` 공유, 골든+CI diff) |
| 인터페이스 표면 최소 / 얕은 통과 / 이름 | OK |
| 삭제 테스트 | OK |

## 새 발견
없음.

VERDICT: SHIP
