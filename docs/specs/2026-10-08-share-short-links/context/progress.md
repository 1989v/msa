# 진행 상태

- 현재 그룹: 8 (문서·통합 검증) — 8.1·8.2 완료, 8.3·8.4 남음
- 완료 커밋: 스펙 c418643ff · G1 d96ab86f8 · G2 0e739d2e2 · G3·4 b6849d6af · G5 544dc0243(+01c6658c9) · G6 36b49197f · G7 f4f66fecc · 문서 06d5edbaa
- 멈춘 이유: usage 89% (2026-10-08 17:31). 테스트 범위 게이트(85%)가 common 전체 스위트를 막고, CDP 측정·verifier 는 토큰을 많이 쓴다

## 다음 세션에서 할 것 (순서대로)
1. `./gradlew :common:test` 전체 — 배포 게이트(images.yml)에 넣었으므로 초록이어야 한다. 다른 세션의 common/analytics 미커밋 변경이 섞인 워킹트리라, 빨강이면 깨끗한 워크트리(HEAD)에서 다시 돌려 원인을 가른다
2. 8.3 CDP 화면 검증 — 블로그·게임·관광지 상세의 `role=group name=공유/Share` 와 「링크 복사」 버튼, `docs/standards/fe-visual-verification.md` 4조합. start·측정·stop 을 한 명령으로
3. 8.4 `hns:verifier`(새 컨텍스트) → `verifications/final-verification.md`, 이어서 `hns:validate --code` · `hns:drift-check` · `hns:validate --docs`
4. 푸시 여부를 사용자에게 묻는다 — 아래 제약 확인 후

## 푸시 전 제약 (필수)
- **place V20 은 다른 세션의 untracked V17~V19 보다 먼저 main 에 들어가면 안 된다.** `outOfOrder=false` 라 V20 이 운영에 먼저 적용되면 이후 V17~V19 가 검증에 걸려 content 기동이 막힌다. 푸시 시점에 V17~V19 커밋 여부를 확인한다
- game V93(untracked, 다른 세션)도 같은 위험 — V105 가 이미 적용됐으므로 그 세션이 번호를 바꿔야 한다. 보고만 한다
- 배포 순서: 해석 경로 배포·실측(apex `/r /p /g /b` 4종 + list 4종 `Location`) 뒤에 운영 설정 `kgd.common.short-link.expose=true`

## 공유 워킹트리 커밋 방법 (이번에 쓴 것)
- 다른 세션 변경이 섞인 파일: HEAD 내용 + 내 변경만 `git hash-object -w` → `git update-index --cacheinfo`
- 남의 스테이지가 index 에 있을 때: 임시 index(`GIT_INDEX_FILE`)에 `git read-tree HEAD` → 내 경로 항목만 `--index-info` 로 옮겨 커밋. `git commit -- <경로>` 는 워킹트리를 다시 담으므로 쓰지 않는다
- 커밋 뒤 깨끗한 워크트리에서 HEAD 단독 컴파일·범위 테스트(비공개 서브모듈은 `.git/modules` 에서 `clone --shared`, node_modules 는 락파일 동일 확인 뒤 심링크)

## 범위 밖 보고 후보
- deal `DealRedirectService.referrerHost/uaFamily` — common ClickContext 로 통합 후보(uaFamily 의미 다름: 봇도 기록)
- 크롤러 판정 3벌(analytics·blog·common)
- place `Attraction.isActive()` 는 확장 함수 — 다른 세션의 Attraction.kt 커밋 후 멤버로 옮길지
- blog `BlogQueryService.publishedOrThrow` 가 `status != PUBLISHED` 직접 비교 — `publiclyVisible` 과 판정 두 곳
- 게이트웨이 forwarded-header 미설정 → `ipKeyResolver` 키가 인그레스 주소일 수 있음(전 경로 공용 버킷)
