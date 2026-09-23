# Progress — 광고 네트워크 (ads)

- 작업 위치: 워크트리 `.claude/worktrees/ads-network`, 브랜치 `feat/ads-network`(origin/main 기준). 공유 워킹트리의 로컬 main 은 origin 과 크게 갈라져 있어 쓰지 않는다
- 서브모듈 gifticon·auth 는 공유 트리의 로컬 클론을 원천으로 이 워크트리에만 초기화했다(`git -c submodule.<s>.url=<로컬> submodule update --init`) — Gradle 구성에 필요

## 완료
- Task Group 1 (R1): `EntityType.AD` + 추천 소비자 테스트. 나머지 R1 항목은 origin/main 에 이미 있었다

## 다음
- R1 푸시·배포는 사용자 확인 후(push-when-done). 코드는 이어서 Task Group 2(ads 모듈 골격·폴드) — 그룹 0(운영 MySQL SQL·시크릿·DNS)은 R2 배포 직전 사용자 승인

## 막힌 것
- 없음

## 함정
- 공유 트리에서 ADR-0095 파일이 untracked 로 보이는 것은 로컬 main 이 211 커밋 뒤처진 탓이다 — 파일 존재 판단은 origin/main 으로
