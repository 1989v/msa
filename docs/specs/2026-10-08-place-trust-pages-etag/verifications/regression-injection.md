# 회귀 주입 (SR-5.4)

주입은 공유 트리가 아니라 HEAD 의 임시 워크트리(`scratchpad/wt-inject`, 2026-10-08)에서 한 건씩 넣고 해당 테스트를 돌린 뒤 되돌렸다. 스크립트 `scratchpad/inject-c-fe.py`. 전부 컴파일되는(구문이 맞는) 변경이다.

## FE (vitest)

| 주입 | 대상 테스트 | 결과 |
|---|---|---|
| 상수에서 행 하나 제거(관광지) | dataSources.test.ts | 종료 1 · 1 failed |
| 대기 실시간 측정 비고 한 글자 변경 | dataSources.test.ts | 종료 1 · 1 failed |
| TourAPI 비고를 관광지 행으로 옮김 | dataSources.test.ts | 종료 1 · 2 failed |
| FE `TRUST_LINKS` 하나 제거 | footerLinksGolden.test.ts | 종료 1 · 2 failed (골든 파일도 다시 써져 CI diff 단계가 함께 막는다) |
| `siteFooter()` 가 `TRUST_LINKS` 를 빼고 그림 | footerLinksGolden.test.ts | 종료 1 · 2 failed |
| 런타임 Footer 가 `TRUST_LINKS.slice(0, 3)` | Footer.test.tsx | 종료 1 · 2 failed |
| 표 셀 `escapeHtml` 제거 | prerenderTrustPages.test.ts | 종료 1 · 1 failed |

되돌린 뒤 같은 네 파일: `Tests 17 passed (17)`, `git status` 깨끗.

## Kotlin (search:app, 스크립트 `scratchpad/inject-c-kt.py`)

| 주입 | 대상 테스트 | 결과 |
|---|---|---|
| Kotlin 바닥글 신뢰 링크 하나 제거 | FooterLinksParityTest | 종료 1 · tests=2 failures=1 |
| `.eTag()` 제거 | AttractionPageControllerTest | 종료 1 · tests=14 failures=8 |
| ETag 를 문서 id 해시로 | AttractionPageControllerTest | 종료 1 · tests=14 failures=1 |
| 해시 입력에 경로 언어를 섞음 | AttractionPageControllerTest | 종료 1 · tests=14 failures=1 |
| 부착 기준을 `status == 200` 으로 | AttractionPageControllerTest | 종료 1 · tests=14 failures=1 |

되돌린 뒤 기준선: FooterLinksParityTest tests=2 failures=0, AttractionPageControllerTest tests=14 failures=0(2026-10-08T13:04 UTC). 12건 모두 빨간불을 확인했다 — 원천·라이선스 열 대조는 SR-1.4 상설 부정 테스트 ②③ 이 상시로 맡는다.
