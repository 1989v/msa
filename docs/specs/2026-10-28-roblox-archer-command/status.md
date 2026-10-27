# Status — 궁수 키우기 로블록스판 · 시작 분지 (2026-10-28)

**상태: 로컬 구현·검증 완료. Studio 실행은 미검증(사용자가 직접 연다).**

## 결과물
- `roblox/archer-command/dist/ArcherCommand.rbxlx` — Studio 에서 File → Open from File. Max Players 2 는 Game Settings 에서 둔다.
- `roblox/archer-command/README.md` — 열기·조작·구조·재생성·검증 범위.
- `docs/research/2026-10-26-roblox-development/README.md` §0 — 이식 원칙(사용자 확정) + 인피니티 스탭 손볼 목록. `porting-prompt.md` 원칙 3 갱신.

## 검증 (명령·출력은 그대로)
```sh
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/archer-command/tools/verify.py
```
```
PASS 88 actual Luau assertions (rules, economy, towers, waves, outpost, hero skills, snapshot, oracle windows) — not Roblox runtime
PASS determinism across two separate luau processes (same seed, same inputs)
PASS compiled 15 Luau files and unknown-global analysis with explicit Roblox allowlist (not Roblox API typechecking)
PASS server/client require only shared Sim·Grid·Balance·Theme·Packet (Campaign stays internal)
PASS deterministic XML: exact 13 scripts, 5 RemoteEvents, services, spawn, lighting (234188 bytes) — not opened in Studio
PASS grid vs parts: all 2808 cells (walkable band clear, blocked covered, ramp wedge, east gate blocked) — collision geometry, not Studio physics
PASS original oracle freshness: sim.js/campaign.js/map.js hashes match verifications/original-bot.md (oracle windows still valid)
UNVERIFIED: Studio Play, Humanoid physics, WalkSpeed 13.75 실측, HRP→Sim 리더 주입 지연
UNVERIFIED: 클라이언트 액터 240 렌더 프레임 시간, 10Hz buffer 패킷 크기, 5Hz 요약 크기
UNVERIFIED: 카메라 피치/거리, 배치·조준 레이캐스트, 터치 배치, 터치 점프 버튼 숨김
UNVERIFIED: 2인 접속, 협동 수락 흐름, 호스트 단독 이어하기(부재 손님 병력), 슬롯 재결속
UNVERIFIED: DataStore UpdateAsync 호출, BindToClose, Studio 메모리 저장소 외 실제 저장
UNVERIFIED: Lighting/Atmosphere 시각, 가시 절벽 높이와 격자 LOS 의 일치
```
원작 오라클(시드 1~20): 정지 봇 리더 사망 **23.33~30.60초**(원작 23.37~29.40) · 무사격 본진 첫 피해 **13.40~13.77초**(원작 13.37~14.13). `verifications/original-bot.md`.
게이트 증명: 21행 주입 전부 빨강 — `verifications/gate-proof.md`.

## 리뷰 처리
- 1차 6차원 전부 REVISE → 개정 1. 2차: 아키텍처·보안·유즈케이스 SHIP, 도메인·테스트·구현 REVISE(상수·문장·코드 버그) → 개정 2 로 반영, 3차 리뷰는 돌리지 않았다.
- 구현 리뷰 코드 버그 B1~B5 전부 수정: 16비트 분할 곱(JS 참조값과 일치 확인) · 자동 고용 제거 · A* 재개(보존 4) · NaN/비문자열 거부 · 슬롯 0/1 가드 · 되돌림 표본 1회 · build 셀 내림 · step 3틱 상한.
- 보안 잔여: 소유자 슬롯에 userId 저장·재입장 결속(구현) · 시드는 서버가 만든다(구현).
- 유즈케이스 잔여: 리더 승계 시 PivotTo(구현) · 손님 저장 안내 토스트(구현) · 호스트 단독 이어하기는 UNVERIFIED 목록.

## Roblox 최적화로 바꾼 것 (원작과 다른 점)
플레이어 아바타 = 선두 활잡이(서버 클램프) · 클라이언트 액터 렌더 · 리더 없음 상태 · 호스트 수락 협동 · 호스트 키 저장 · 안개 없음 · 길 위 무리 없음(원작 조건) · Esc/Tab/R 없음 · Terrain 덧칠 + Clouds. 수치·리듬은 원작 그대로.

## 사용자에게 알릴 것
- **원작 현재 밸런스는 단순 봇이 전부 23~30초에 죽는다**(원작 status 의 「밸런스 한계 — 사용자 답변 대기」). 이식판도 같다. 쉬워지면 이식 오류다. 밸런스는 원작에서 먼저 바꾼다.
- 병렬 세션의 `roblox/AGENTS.md` 는 「구현은 gpt-6.1-sol 위임」「커스텀 카메라를 기본값으로 삼지 않는다」고 적었다. 이 작업은 사용자가 이 세션에서 직접 고른 「이 세션 직접 구현」「탑다운 고정 카메라」를 따랐다 — 둘 중 어느 쪽을 표준으로 둘지 사용자 결정.
- 메모리 교정(수치 복제 강제 아님)대로 수치는 「같아야 한다」가 아니라 「같게 두었다」다. 바꾸려면 Balance.luau 한 파일이다.
