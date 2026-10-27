# Task Breakdown: 궁수 키우기 로블록스판 · 시작 분지

## Overview
한 묶음(독립 프로젝트 `roblox/archer-command/`). 사용자 승인: 범위 「시작 분지 전부」, 표현 「3D 파트 + 탑다운 카메라」, 「1~2인 협동」, 「이 세션 직접 구현」, 「로블록스 구성에 최적화」.

### Task Group 1: 순수 시뮬레이션 (shared)
**Dependencies:** spec 개정 2
- [x] 1.1 `Balance.luau` 원작 수치 (px÷8)
- [x] 1.2 `Grid.luau` 분지 격자·A*(재개형)·LOS·흐름장·건설 판정 — 빌더가 읽는 RECTS/SITES 주석
- [x] 1.3 `Campaign.luau` 사냥터·거점 25·전초기지·웨이브 대기열·행렬(원작 noise 를 16비트 분할 곱으로 재현)
- [x] 1.4 `Sim.luau` 명령·경제·전투·목수·탑·영웅 Q/E·리더 검사·리더 없음·협동 전환·스냅샷·요약
- [x] 1.5 `Packet.luau` 10Hz buffer · `Theme.luau` 토큰

### Task Group 2: Roblox 서버·클라이언트
- [x] 2.1 `Main.server.luau` 세션·호스트 수락·틱(≤3)·리더 되돌림·구르기·탑 모델·Terrain 덧칠·저장 타이머
- [x] 2.2 `Save/Commands/Ingress.luau` 호스트 키 UpdateAsync·명령 스키마·토큰 버킷
- [x] 2.3 `Camera/Actors/Hud.client.luau` 탑다운 카메라·클라이언트 액터 렌더·HUD/패널/배치/조준/로비

### Task Group 3: 빌더·검증·문서
- [x] 3.1 `tools/build_place.py` 결정적 rbxlx (지형·조명·구름·스크립트)
- [x] 3.2 `tests/run.luau` 86 단언 + 원작 오라클 · `tools/dump_grid.luau` · `tools/verify.py`
- [x] 3.3 게이트 증명 `verifications/gate-proof.md`
- [x] 3.4 README · status · 하네스 원장

**Acceptance Criteria:** verify.py 전부 PASS, 주입 전부 RED, 원작 오라클 창 안. Studio 실행은 사용자 확인(UNVERIFIED).

## Execution Order
Grid·Balance → Campaign·Sim → 서버 → 클라이언트 → 빌더 → 검증 → 게이트 증명 → 문서.
