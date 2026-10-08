# review-verdict-round1 — `/tech/search` 1라운드 (2026-10-08)

판정자 `hns:review-verdict`(읽기 전용, 메인이 저장). **keep 41 / demote 3 / dismiss 0**, BLOCK 0, 전체 REVISE. 전문(발견별 JSON·편집 목록)은 세션 메시지 — 핵심만 옮긴다.

| 묶음 | 판정 | 채택안 |
|---|---|---|
| G1 빌드 체인(arch A1·impl#1·sec#1·uc#1·test F2) | keep REVISE | (a) 생성물 미커밋 유지 + 렌더 스텝을 package.json(build·dev)·Dockerfile:41·ci.yml Type check 앞 세 곳에 같은 순서, 렌더가 `tsc -b` 앞. `import.meta.glob` 기각. **사용자 판단 필요**(Dockerfile·CI 변경) |
| G2 fencesvg 계약 | keep REVISE | 펜스마다 `renderDiagram`, `<figure class="fs-figure">…<figcaption>` 은 스크립트가; svg 수 == 펜스 수 |
| G3 프리렌더 | keep REVISE | `renderTechSearchHtml` 순수 함수 export, JSON 은 main 에서, 실패는 `PartialSeoFailure` |
| G4 vitest 위치 | keep REVISE | `src/content/__tests__/` + `@vitest-environment node` |
| G5 드리프트 | keep REVISE | 9값, 행당 값 하나(백틱 토큰), 가중치는 `application.yml:72-73`, 모델 ref 두 매니페스트, 존재 단언 |
| G6·G6' 트립와이어·금칙 | keep REVISE | 태그 7종·href 스킴·주석 제거·금칙 패턴, 「sanitizer 아닌 트립와이어」 명시 |
| G7 진입 NAV | keep REVISE | 아틀라스 NAV 한 줄 예외 |
| G8 한눈에·모바일 | keep REVISE | 요약 블록(기법 이름만, 값 없음) + 첫 화면 AC, 레인은 프로세스·저장소만, 390 그림별 비율 2.0 |
| G9 SHA·신선도 | keep | `gitSha` 빌드 스탬프, `data-source-hash`, 기기×사이트 4조합 × 뷰포트 2 |
| G10 useSeo | keep REVISE | canonical + jsonLd, 빌더는 copy.mjs 공용 |
| G11·G12 | keep MINOR | manual_links 글롭 하나, generated 는 `src/pages/tech/generated/` |
| 도메인 D-1·2·3·5·6 | keep REVISE | 가중치는 키워드 레그 안(융합 전), 완결성 ln1p 행, 주변 4종 명칭, 과제 번호 제거, 통합 7종·필드 8개 |
| D-4·D-8·D-9 | demote MINOR | 공개 페이지는 「쿼리 벡터」, glossary 는 post-impl, 사실 항목만 |
| 마크업·sec#4·uc#6·uc#9·test F7 | keep | renderer 오버라이드 3종, `#root` 안만 단언, 「게이트는 9값뿐」 명시 + 근거 파일 존재 검사, 「자체 검색 면」 |

NOTES: 평가 CronJob 은 `cronjob-eval.yaml` `30 22 * * *` = **KST 07:30**(05:30 은 낡음) · Dockerfile `ARG GIT_SHA` 를 :41 앞으로 올려야 렌더가 받는다 · `AttractionHybridProperties.kt` 는 `application/attraction/config/`.
