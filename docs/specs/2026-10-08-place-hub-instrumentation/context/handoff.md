# 이어받기 메모 — S1-12b place 허브 계측 (2026-10-08 10:5x KST)

## 작업 위치
- 구현 워크트리: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` (branch `place-stage2`, origin/main `8a61f0b`). 메인 트리 `/Users/gideok-kwon/IdeaProjects/msa` 는 다른 세션의 미커밋 변경(analytics·common)이 섞여 있어 건드리지 않는다.
- 스펙: `docs/specs/2026-10-08-place-hub-instrumentation/` — `spec.md`(2라운드 개정본 131줄), `planning/`, `context/`(리뷰 6건 × 3라운드 누적, `review-verdict-round2.md`).

## 환경 함정 (워크트리)
- `portal-fe/node_modules` 는 메인 트리 심링크(락파일 동일 확인). `npx vitest run <파일>` 로 범위 지정.
- `gifticon`·`auth` 서브모듈은 비공개 레포라 현재 gh 계정(kwongd)으로 HTTPS 클론이 막힌다 → 메인 트리 `.git/modules/<sm>` 에서 `git clone --shared` 로 채웠다. auth 는 origin/main 이 가리키는 `eca3e91` 이 로컬에 없어 메인 트리 HEAD(`4a784c4`) 체크아웃 — `git status` 에 `M auth` 가 뜨지만 **커밋에 담지 않는다**(내 파일만 `git add` 경로 지정).
- Gradle: `./gradlew :analytics:app:test --tests '*CollectEventItemTest' --offline -q` 꼴로 범위 지정(훅 `test-scope-gate.sh` 가 범위 없는 명령을 막는다).

## 기준선 (수정 전)
- vitest 5파일 92 passed(tracker 10·FavoriteButton 6·PlacePage 16·AttractionPage 51·RegionPage 9).
- Kotest `CollectEventItemTest` 3/0, `ClickHouseAttractionPopularityAdapterTest` 4/0.

## 파이프라인 상태
- shape → write → review 1라운드(BLOCK 4, 심판 keep 38) → 개정 → 2라운드(전부 REVISE, 심판 keep 26, 상충 5건 결정) → 개정 → **3라운드 디스패치됨(마지막 허용 라운드)**. 전부 SHIP 이면 `hns:create-tasks` → 승인 게이트(사용자 「이어서 마지막까지」 지시로 자동 진행, 보고에 명시) → `hns:implement-tasks`(워크트리에서만) → 검증(회귀 주입 8건) → origin/main 푸시(gh 계정 1989v 전환 후 즉시 kwongd 복귀) → 배포 뒤 CDP(일반 UA) + `ssh msa-oci` ClickHouse → `evidence/stage2/` + 아티팩트 「작업 결과」 탭 §13.
- 3라운드가 SHIP 이 아니면 프로토콜상 BLOCK 으로 취급 → 사용자에게 보고하고 멈춘다.

## 세션이 대신 결정한 것 (최종 보고에 명시)
- 1라운드: 중복 키·eventId 에 섹션(노출 포함, 상세 두 섹션 겹침 2행 수용).
- 2라운드 §2: overlay 트리거 제거 · 선택률 view 전환 + 튜플 제한 · `POST_SELECTION_SECTIONS` · PAGE 판별 합집합 · 가운데 클릭 미계측.
