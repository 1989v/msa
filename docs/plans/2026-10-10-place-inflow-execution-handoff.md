# place 유입 플랜·남은 범위 일괄 진행 — 이어받기 문서 (2026-10-10)

사용자 지시(2026-10-10): 「분석/플래닝한 거 모두 다 진행, 끊어가지 말고」. 사용자 몫은 마지막에 한꺼번에.

## 묶음과 스펙 폴더
| 묶음 | 플랜 ID | 스펙 폴더 |
|---|---|---|
| H1 유입 측정 | I0-5 · I0-6 | `docs/specs/2026-10-10-place-inflow-measurement/` |
| H2 크롤 우선순위·색인 정리 | I1-1 · I1-3 · I2-6 · I3-3 + 랜딩 X-Robots-Tag · `/en/attractions/{국문id}` | `docs/specs/2026-10-10-place-crawl-priority/` |
| H3 화면 마무리 | 데스크톱 허브 필터 압축(S2-3b 데스크톱) · 카드 제목 링크색 · primary 버튼 다크 대비 · 시트 제목 대비 · 모바일 상세 긴 칸 접기 | `docs/specs/2026-10-10-place-screen-polish/` |
| H4 판정 세트 | S3-6b | `docs/specs/2026-10-10-search-judgment-cases/` |
| H5 방문량 추천·가는 법 | S4-3 · S4-4 | `docs/specs/2026-10-10-place-visits-and-access/` |
| H6 글 초안 | S4-5 (데이터 스토리 2 + 빌드 스토리 1, 게시는 사용자) | `docs/specs/2026-10-10-place-stories/` |

## 진행 방식
스펙 작성 → 리뷰(관점 묶음 2개 + 심판) → 반영 → tasks → 구현(그룹별 구현 에이전트, 메인이 검증 재실행, 경로 지정 커밋) → 임시 사본 회귀 주입 → 배포 → 운영 확인 → 아티팩트 「작업 결과」·볼트 기록.
리뷰를 관점 6개 병렬 대신 2묶음(아키텍처·구현·보안 / 테스트·도메인·유스케이스)으로 줄인다 — 지시가 「끊지 말고 끝까지」라 시간 대비. 심판은 그대로 둔다.

## 작업 위치·함정 (이전 문서와 같음)
- 워크트리 `scratchpad/wt-impl`(branch place-stage2 → origin/main 푸시). 메인 트리 금지.
- OCI 는 `ssh msa-oci` 만. 푸시는 `gh auth switch --user 1989v` → 푸시 → `kwongd` 복귀 → `gh api user` 확인.
- 같은 파일을 고치는 구현은 순서대로(PlacePage·copy.mjs·prerender-seo.mjs·nginx.conf·AttractionPageRenderer).
- 외부 데이터를 붙이면 `docs/architecture/data-sources.md` 대장 갱신 필수(3규칙).
- 헤드리스 크롬은 start·측정·stop 한 명령. Lighthouse 와 다른 브라우저 측정을 겹치지 않는다.

## 사용자 몫 (마지막에 한꺼번에)
GSC 색인 기준선 · 서치어드바이저 RSS 제출 · Bing 등록 · IndexNow Secret·켜기 · 스위치 넷·ADR 승인 · 편집·글 초안 검수·게시 · 공공데이터포털 활용사례 등록 · 네이버 블로그 채널 · 커뮤니티 출시 · 이전 목록(아티팩트 §16).
