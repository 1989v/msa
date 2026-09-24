# Progress — 광고 네트워크 (ads)

- 작업 위치: 워크트리 `.claude/worktrees/ads-network`, 브랜치 `feat/ads-network`(origin/main 기준). 공유 워킹트리의 로컬 main 은 origin 과 크게 갈라져 있어 쓰지 않는다
- 서브모듈 gifticon·auth 는 공유 트리의 로컬 클론을 원천으로 이 워크트리에만 초기화했다(`git -c submodule.<s>.url=<로컬> submodule update --init`) — Gradle 구성에 필요

## 완료
- Task Group 1 (R1): `EntityType.AD` + 추천 소비자 테스트. 나머지 R1 항목은 origin/main 에 이미 있었다. 푸시 04d3d06d — images 게이트가 game `SaveCipherTest` 의 확률적 실패로 막혀 재실행, 테스트 고정 커밋 cac80e31 은 재실행 성공 뒤 푸시
- Task Group 2: ads 모듈 골격·폴드 배선 (로컬 커밋만 — **그룹 0 운영 사전 조건 전에는 푸시 금지**, engagement 가 ads_db·시크릿 없이는 못 뜬다)

## R2 운영 반영 (2026-09-24)
- 사전 조건: 운영 MySQL 1회 SQL(ads_db·ads_user) · 시크릿 `ads-token`(호스트에서 생성, 64자) — `ssh msa-oci` 로 직접
- 이미지: 내 push run 이 뒤 push 에 밀려 취소 → 수동 dispatch 가 다른 세션의 대기 run 을 취소시켜, dispatch 를 취소하고 그 run(common 포함 → 전 JVM)을 재실행해 해소. 태그 `ace7837`
- 확인: engagement·gateway 롤아웃 1/1 · 442Mi/768Mi · Flyway V1~V3 · `/decisions` 200(HOUSE 3종) · rt 404 · 옛 `/placements/game-list-banner` 200 · 집계 첫 실행 1시각 Redis 첫 연결 실패 → 다음 실행 재처리(`failed=0 closed=1`)
- 보고만: engagement 로그의 `httpcore5 NoClassDefFoundError` 는 recommendation ClickHouse 클라이언트 WARN(대체 동작), ads 무관

## R3 운영 반영 (2026-09-24)
- 푸시 56531f9d → images 성공(35994747505) → engagement·portal-fe·admin-fe `56531f9` 롤아웃
- 확인: CDN 이 내주는 `AdSlot-*.js` 에 결정 호출 · `PrivacyPage-*.js` 에 광고 방침 문구 · 결정 API 200(유료 없음 → AdSense·HOUSE 경로) · 광고주 API 비로그인 401 · admin-fe 번들에 「광고 심사」
- 함정: 광고 코드는 늦게 로드되는 청크라 메인 번들이 직접 참조하는 청크만 훑으면 「없다」로 오판한다 — 파드의 assets 를 직접 grep 해서 확인했다

## 다음
- 사용자: Cloudflare `ads.1989v.com` proxied DNS → 콘솔 확인(E1 전 흐름: 등록·충전·캠페인·소재·승인·게재·클릭·정산)
- R4(그룹 13): HOUSE 배너가 새 API 로 도는 것이 운영에서 확인됐으므로 game ads 코드·표·호환 경로 제거 가능
- 운영 확인 남음: E2(대체 순서 화면)·E4(결정 P99)·E5(광고주 본인 청구 0)
- 보고만 한 기존 부채: ci.yml 다른 서비스의 옛 `:{svc}:app:test` · prod-k8s `db-password-experiment.yaml` 대상 없음 · engagement 의 ClickHouse httpcore5 WARN

## 막힌 것
- 없음

## 함정
- 공유 트리에서 ADR-0095 파일이 untracked 로 보이는 것은 로컬 main 이 211 커밋 뒤처진 탓이다 — 파일 존재 판단은 origin/main 으로
- ads 스케줄 작업 빈마다 `ads.scheduling.enabled` 조건을 달아야 한다 — 호스트 스케줄링은 outbox 토글로 따로 켜진다
