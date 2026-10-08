# Engineer Review — usecase (1라운드)

대상: `docs/specs/2026-10-08-place-trust-pages-etag/spec.md` · 계획 `docs/plans/2026-10-08-place-growth-work-plan.md` S2-8(:82)·S2-9(:83)·S4-6(:110). 세션 결정 ①~⑥은 재론하지 않는다.

## 행위자 × 흐름 대조

| 행위자 | 목표 | 주 흐름 | 스펙 대응 |
|---|---|---|---|
| 방문자(국문 place) | 신뢰 정보 확인 | 런타임 Footer → `/about`·`/contact`·`/privacy`·`/data-sources` | SR-2.3, SR-1 — 충족 |
| 방문자(영문 place `/en`) | 같음 | `Footer lang="en"`(`PlacePage.tsx:1488`, `RegionPage.tsx:304`, `AttractionPage.tsx:574`) | **문구 미정** — 이슈 1 |
| 크롤러(JS 없음) | 링크 발견·재검증 | 프리렌더 `shellBody`/SSR `shellBody` 바닥글, 상세 SSR 조건부 요청 | SR-2.1, SR-4 — 폴백 경로 누락(이슈 2), 검증 경로가 크롤러와 다름(이슈 3) |
| 광고 심사자 | place 호스트에서 방침·소개·연락처·출처 확인 | 호스트 무관 서빙(`nginx.conf:138-149`) + 전역 라우트(`App.tsx:246-249`) | SR-1.1 nginx 정규식 확장 — 충족 |

## 체크리스트

1. **Actor-goal 정의** — 부분. 위 셋이 Goal(spec.md:7)에 함축돼 있으나 영문 화면 방문자의 목표가 빠짐.
2. **Main/Alt/Exception 흐름** — 부분. 304 주 흐름·404/폴백 예외(SR-4.1)는 명시. Cloudflare 가 ETag 를 지우는 경우(Q1)의 완료 판정이 없음(이슈 4). 셸 폴백 화면의 링크 부재가 Goal 과 충돌(이슈 2).
3. **Pre/Postconditions** — 충족. 사후조건 「대장 == 페이지」를 게이트(SR-1.4)로 고정.
4. **AC 추적성** — 부분. S2-9 「페이지 존재·링크 노출」→ SR-5 CDP·curl 단언으로 추적됨. S2-8 lastmod 항목은 `plan:21`(S1-9 완료로 삭제)·`planning/initialization.md:2` 와 일치. S2-8 「304 응답 확인 (→ 크롤 통계의 304 비율)」(plan:82) 의 괄호 부분은 스펙에 대응이 없음(이슈 4에 포함).
5. **엣지 케이스** — 부분. 이슈 2·3.
6. **테스트 매핑** — 충족(SR-5). 다만 배포 뒤 확인이 gzip 경로를 안 탄다(이슈 3).

## 이슈 (REVISE, 비차단)

### 1. 영문 place 화면의 링크 문구가 정해지지 않았다 (체크 1·5)
- 근거: `Footer.tsx:18-24` 는 `lang` 을 받고 `:39` 에서만 영문을 쓴다. 정책 링크 셋 `:47-55` 는 lang 과 무관하게 국문 고정이다. SR-2.3 은 「데이터 출처 링크 한 줄 추가」만 말해 영문 화면에도 국문 「데이터 출처」가 붙는다. SSR `AttractionPageRenderer.kt:648-663` 의 `siteLinks()` 도 lang 을 받지 않아 `/en/attractions/*` 초기 HTML 이 국문 라벨이다. SR-2.1 「같은 순서·같은 문구」가 이 상태를 패리티로 굳힌다. Out of Scope(spec.md:39) 「영문 페이지」는 대상 페이지의 영문판을 뺀다는 뜻으로 읽히고 링크 라벨은 다루지 않는다.
- 수정안: SR-2 에 한 줄 결정을 추가한다. 권장안은 런타임 Footer 가 `lang === 'en'` 이면 「About · Contact · Privacy policy · Data sources」를 쓰는 것이다(대상은 국문 페이지라고 명시). 초기 HTML 은 국문 고정을 유지하되 「영문 화면 초기 HTML 바닥글도 국문 라벨」이라고 적어 패리티 테스트 범위를 분명히 한다. 반대로 국문 고정을 택하면 그 사실만 적는다.

### 2. Goal 「place 의 모든 화면(JS 없이 보는 크롤러 포함)」이 셸 폴백 경로에서 거짓이 된다 (체크 2·5)
- 근거: 다음 경로는 맨 `index.html`(`portal-fe/index.html:139` `<div id="root"></div>`, 바닥글 없음)을 낸다.
  - 개요 없는 지역: `nginx.conf:228-236` (`try_files … /index.html`)
  - 상세 프록시 폴백: `nginx.conf:205-212` (`X-Render: proxy-fallback`)
  - search 셸 폴백: `AttractionPageController.kt:39` (`shell-fallback`)
- 수정안: Goal 을 「프리렌더·SSR 본문이 있는 화면」으로 좁히고, 위 세 경로를 Out of Scope 에 알려진 예외로 적는다. SR-5 의 「지역 초기 HTML 에 4링크」 확인은 **프리렌더 파일이 있는 지역 코드**로 한다고 명시한다. 그렇지 않으면 개요 없는 지역을 고른 검증이 빨강이 된다.

### 3. 배포 뒤 304 확인이 크롤러 경로를 재현하지 않는다 (체크 5·6)
- 근거: SR-4.4(spec.md:30)는 `curl -sI` 를 쓴다. `Accept-Encoding` 이 없으면 `nginx.conf:41` gzip 이 동작하지 않는다. 그래서 강한 ETag 경로만 확인되고, SR-4.2 가 겨냥한 `W/` 경로(실제 크롤러는 gzip 을 보낸다)는 라이브에서 확인되지 않는다. HEAD 응답도 GET 과 다른 경로다.
- 수정안: SR-4.4 를 「GET + `Accept-Encoding: gzip` 으로 받은 ETag(`W/` 포함 여부 기록)를 그대로 `If-None-Match` 로 재요청 → 304」로 바꾼다. 비압축 요청 결과는 보조로 기록한다.

### 4. Q1 이 부정(Cloudflare 가 ETag 를 지움)일 때의 완료 판정이 없다 (체크 2·4)
- 근거: 계획 완료 조건은 「304 응답 확인 (→ 크롤 통계의 304 비율)」(plan:82)이다. 스펙은 Cloudflare 설정 변경을 범위 밖으로 둔다(spec.md:39). `context/open-questions.yml` Q1 은 「기록」만 약속한다. 공개 주소에서 304 가 안 나오면 S2-8 이 완료인지 미완료인지 스펙만으로 판정할 수 없다.
- 수정안: SR-4.4 에 분기를 적는다. origin 304 확인으로 S2-8 은 완료로 본다. 공개 주소에서 ETag 가 사라지면 그 사실과 Cloudflare 측 후속(설정 변경은 사용자 몫)을 계획서 S2-8 행 비고에 남긴다. 크롤 통계 304 비율은 배포 후 관찰 항목으로 계획서에 넘긴다고 한 줄 둔다.

VERDICT: REVISE
