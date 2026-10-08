# 진행 상태

- 현재 그룹: 8 — 8.1·8.2·8.4 완료, 8.3(CDP) 남음. 작업 브랜치 `feat/share-short-links`(origin/main 기반)
- 완료 커밋: 스펙 c418643ff · G1 d96ab86f8 · G2 0e739d2e2 · G3·4 b6849d6af · G5 544dc0243(+01c6658c9) · G6 36b49197f · G7 f4f66fecc · 문서 06d5edbaa
- 멈춘 이유: usage 89% (2026-10-08 17:31). 테스트 범위 게이트(85%)가 common 전체 스위트를 막고, CDP 측정·verifier 는 토큰을 많이 쓴다

## 다음 세션에서 할 것 (순서대로)
1. ~~common 전체 스위트~~ — 재기반 브랜치에서 23 스위트 169/0 (완료)
2. 8.3 CDP 화면 검증 — 블로그·게임·관광지 상세의 `role=group name=공유/Share` 와 「링크 복사」 버튼, `docs/standards/fe-visual-verification.md` 4조합. start·측정·stop 을 한 명령으로
3. 8.4 `hns:verifier`(새 컨텍스트) → `verifications/final-verification.md`, 이어서 `hns:validate --code` · `hns:drift-check` · `hns:validate --docs`
4. 푸시 여부를 사용자에게 묻는다 — 아래 제약 확인 후

## origin 재기반 (2026-10-08 20시대)
- origin/main 이 리베이스·강제 푸시돼 시작 커밋(c783eaf30)이 사라졌고 735커밋 앞서 있었다. 공유 트리는 건드리지 않고 별도 워크트리 브랜치 `feat/share-short-links` 에서 origin/main 위로 내 커밋 11개를 cherry-pick 했다(충돌 5회).
- 마이그레이션 번호 재지정: code-dictionary V22→V31, game V105→V106(origin V105 = duel defense seed), blog V2→V4, place V20→V33. ADR-0103→**ADR-0106**(origin 0103~0105 사용 중).
- 예전 제약(place V17~V19 선행)은 사라졌다 — origin 은 이미 V32 까지 있다.
- 충돌 해소 요지: blog 상세 DTO·서비스는 origin 의 conceptIds 와 공존, 관광지 상세는 origin 의 엣지 캐시 헤더(ADR-0105)를 유지하고 본문만 shortUrl 포함, 게임·관광지는 origin 이 찜 별을 제목 줄로 옮겨 공유 패널을 그 아래 줄로.

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
