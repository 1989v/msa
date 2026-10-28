<!-- source: roblox/amp-arena/src/server/Combat.luau, roblox/amp-arena/tools/verify.py -->

# Tasks — AMP ARENA 로블록스

- [x] 1 공유: `Config`·`Styles`·`Moves`·`Accessories`·`Poses`·`Rules`·`Theme` + `tests/rules.spec.luau` (luau CLI 통과)
- [x] 2 서버: `Commands`·`Rigs`·`Combat`·`Items`·`Projectiles`·`Bots`·`Main.server`
- [x] 3 클라이언트: `Input`·`Poser`·`Effects`·`Hud`
- [x] 4 빌더 `tools/build.py`(로비·맵 2·템플릿·Remotes·StarterPlayer R6) · `tools/verify.py` 네이티브 게이트 · 게이트 증명 24/24 RED
- [x] 5 README · ASSETS · status · 하네스 원장 · 메모리 · 커밋
- [x] 6 스펙 리뷰 1차 6차원 REVISE 반영(단일 피해 진입점·require DAG·Rules 결정 함수·Commands 시계 주입·줍기 거리·아군 KO·장비 로비 한정·용어/모드/신뢰 경계) → 2차 리뷰
- [x] 7 스펙 리뷰 2차 반영 — usecase REVISE 2건: 서바이벌 시간 종료 승자는 생존자 중 순위 1위(`Rules.survivalWinner`), KO·퇴장 폭탄 드랍은 `Combat.cleanup → hooks.dropItem` 한 경로, 미사용 점수 상수 제거 · security SHIP(권고: validate 게이트를 핸들러 본문 모양으로, 주입 Y 25/25 · 네트워크 절 코드 대조). architecture REVISE 2건(폭탄 드랍 ✓ · **`Commands` 의 `../shared/Config` 문자열 require 는 Studio 트리에서 안 풀린다** → `Commands.configure(Config.LIMITS)`, `../` require 금지 게이트) · domain REVISE 6건(승자 ✓·낙사→링아웃·순위 버튼→점수판·M2→R·주석 직업→스타일·팀 점수 문장) · test-strategy REVISE 4건(`Rules.canHit` 호출·결정 함수 게이트 21종·압박 불변식 전 사슬·주입 7건 추가 32/32·`Rules.guardAfterBlock`·경계값) · implementation REVISE 5건(폭탄 드랍 ✓·결과 단계 `setFrozen` 이 속도 제약도 끔·로비 재선택 몸집 절댓값 복귀+액세서리 스케일·`BreakJointsOnDeath false`·KO 크레딧을 Health 전에 기록, 주입 Z8·Z9 34/34)
