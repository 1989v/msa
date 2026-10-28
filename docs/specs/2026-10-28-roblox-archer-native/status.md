<!-- source: roblox/archer-command/src/server/Main.server.luau, roblox/archer-command/tools/verify.py -->

# Status — 궁수 키우기 로블록스 네이티브 재개발 · 시작 분지 (2026-10-28 → 10-29 2차)

**상태: 1차 플레이 피드백 4건 반영 완료(2026-10-29). Studio 재확인 대기.**

## 2차 (2026-10-29) — 사용자가 Studio 에서 본 결함 4건
| 지적 | 바꾼 것 |
|---|---|
| 공격 모션을 안 함 | NPC 활잡이·좀비는 서버가 Action 우선순위 공격 트랙(R15 `toolslash`, R6 129967390)을 쏠 때마다 재생. 플레이어 자신은 자기 화살 Fx 를 받은 클라이언트가 같은 ID 로 재생하고 서 있으면 표적을 향해 돈다. 좀비 근접 피해는 휘두름에 맞춰 0.25초 뒤 |
| 좀비가 한 줄로 옴 | 웨이브 입구 4곳(동·남동·북동·북 가장자리)에서 무작위, 흩뿌림 14 스터드, 묶음 4마리·간격 0.9초×(0.5~1.5), 개체마다 WalkSpeed ±25%, 목적지를 반경 6 스터드 안에서 3초마다 다시 뽑는다 |
| 초반 과난이도 | 군자금 300 · 첫 웨이브 75초 뒤 6마리(10→6, 간격 50초) · 좀비 48hp/피해 6/보상 15 · 사냥터 5마리 8초 보충. 튜토리얼이 공업→공업→방업→사냥터 순으로 안내하고 핫바의 눌러야 할 버튼이 깜빡인다(State.hint) |
| 치료사가 누군지 모름 | 제단 위 치료사 NPC(아바타, 흰 옷, 이름표 「치료사 · 곁에 서면 빨리 낫는다」, 초록 광원, 오라 파티클이 치료 중 짙어짐). 반경 14 안 초당 20 회복, 낫는 대상에 1초마다 초록 파티클. 체력 60% 아래면 안내 토스트 |

검증 2차 출력(명령 같음):
```
PASS 46 actual Luau assertions on shared Config/Rules (prices, hire limits, upgrades, combine, damage, waves, tower placement, save sanitize) — not Roblox runtime
PASS compiled 15 Luau files and unknown-global analysis with explicit Roblox allowlist (not Roblox API typechecking)
PASS shared modules never touch Roblox services (pure rules stay CLI-testable)
PASS client scripts require only ReplicatedStorage.ArcherCommand (no server modules)
PASS exactly 14 scripts in the place and none inside embedded assets
PASS deterministic XML: services, spawn, lighting, 3 RemoteEvents, prompts, lights (5220158 bytes, 1865 parts) — not opened in Studio
PASS 16 embedded models are Roblox-owned (creator id 1) with matching sha256 in provenance.json; 3 scripts in the raw files were stripped at build
PASS default Roblox camera stays default: Scriptable appears only inside the quarter-view toggle and Custom is restored on exit
PASS camera distances within public references: default zoom 12~36, quarter view 32 (max 44) — the first port used 96~150
PASS player character carries a PointLight (range 28) and allies carry one too — brightness/visual quality itself is Studio-only
PASS arrow visuals: Trail with LightInfluence 0 + Neon head + muzzle PointLight + impact ParticleEmitter + Sound (Weapons Kit pattern)
PASS no web-style key hints or jump buttons in client UI strings ([])
PASS NPC templates are Humanoid rigs with Motor6D joints (Roblox Zombie, Bat wings, R6 fallback) and allies come from HumanoidDescription avatars
PASS concurrent enemy cap 60 ≤ 60 for server Humanoid rigs
PASS no jump: CharacterJumpPower 0 (default touch jump button hides itself) and no custom jump GUI
PASS night lighting preset: ClockTime 21.5, Technology Future, Atmosphere + Bloom (visual result is Studio-only)
PASS attack motion: NPC archers and zombies play an Action-priority attack track on the server, the local player plays toolslash on its own character when its arrow Fx arrives
PASS swarm spread: waves enter from 4 bowl edges, per-enemy WalkSpeed jitter 0.25, destination wobble 6 studs re-rolled every few seconds
PASS healer is a visible NPC: HumanoidDescription avatar with name sign, green light, aura particles, tag Healer; heal 20 hp/s near it with per-second heal Fx
PASS upgrade-first opening: 300 starting gold, first wave at 75s, tutorial step 1 points at the attack-upgrade button and the HUD pulses it
INFO world: 86 Roblox-owned models placed, 2 ProximityPrompts (counts are scale, not quality evidence)
UNVERIFIED: Studio Play, Humanoid physics/MoveTo on Terrain hills, stuck-jump, NPC animation IDs actually playing
UNVERIFIED: CreateHumanoidModelFromDescriptionAsync in Studio (network), BlockRig fallback posture, Model:ScaleTo on R6 Zombie
UNVERIFIED: arrow/trail visibility and sound IDs audible, PointLight look under Future lighting, Atmosphere density by eye
UNVERIFIED: default camera feel vs quarter-view toggle, touch tap placement, pinch zoom, ProximityPrompt panels
UNVERIFIED: 2 players, host handoff, DataStore UpdateAsync outside Studio, BindToClose save
UNVERIFIED: balance: upgrade-first opening and 6-zombie first wave at 75s — numbers in Config.luau are a second guess after one play session
UNVERIFIED: attack track visually reads as a bow shot (toolslash is a swing), swarm spread by eye, healer NPC pose on the shrine ring
exit=0
```
게이트 증명 2차: `verifications/gate-proof.md` Q~T 4/4 RED(R 은 게이트를 고친 뒤).


## 결과물
- `roblox/archer-command/dist/ArcherCommand.rbxlx` — Studio File → Open from File. Max Players 2 는 Game Settings 에서.
- `roblox/archer-command/README.md`(열기·조작·구조) · `ASSETS.md`(출처) · `assets/roblox/provenance.json`(해시).
- 조사 근거 `docs/research/2026-10-26-roblox-development/reference-analysis.md`.

## 검증 (명령·출력은 그대로)
```sh
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/archer-command/tools/verify.py
```
```
PASS 44 actual Luau assertions on shared Config/Rules (prices, hire limits, upgrades, combine, damage, waves, tower placement, save sanitize) — not Roblox runtime
PASS compiled 15 Luau files and unknown-global analysis with explicit Roblox allowlist (not Roblox API typechecking)
PASS shared modules never touch Roblox services (pure rules stay CLI-testable)
PASS client scripts require only ReplicatedStorage.ArcherCommand (no server modules)
PASS exactly 14 scripts in the place and none inside embedded assets
PASS deterministic XML: services, spawn, lighting, 3 RemoteEvents, prompts, lights (5210508 bytes, 1865 parts) — not opened in Studio
PASS 16 embedded models are Roblox-owned (creator id 1) with matching sha256 in provenance.json; 3 scripts in the raw files were stripped at build
PASS default Roblox camera stays default: Scriptable appears only inside the quarter-view toggle and Custom is restored on exit
PASS camera distances within public references: default zoom 12~36, quarter view 32 (max 44) — the first port used 96~150
PASS player character carries a PointLight (range 28) and allies carry one too — brightness/visual quality itself is Studio-only
PASS arrow visuals: Trail with LightInfluence 0 + Neon head + muzzle PointLight + impact ParticleEmitter + Sound (Weapons Kit pattern)
PASS no web-style key hints or jump buttons in client UI strings ([])
PASS NPC templates are Humanoid rigs with Motor6D joints (Roblox Zombie, Bat wings, R6 fallback) and allies come from HumanoidDescription avatars
PASS concurrent enemy cap 60 ≤ 60 for server Humanoid rigs
PASS no jump: CharacterJumpPower 0 (default touch jump button hides itself) and no custom jump GUI
PASS night lighting preset: ClockTime 21.5, Technology Future, Atmosphere + Bloom (visual result is Studio-only)
INFO world: 86 Roblox-owned models placed, 2 ProximityPrompts (counts are scale, not quality evidence)
UNVERIFIED: Studio Play, Humanoid physics/MoveTo on Terrain hills, stuck-jump, NPC animation IDs actually playing
UNVERIFIED: CreateHumanoidModelFromDescriptionAsync in Studio (network), BlockRig fallback posture, Model:ScaleTo on R6 Zombie
UNVERIFIED: arrow/trail visibility and sound IDs audible, PointLight look under Future lighting, Atmosphere density by eye
UNVERIFIED: default camera feel vs quarter-view toggle, touch tap placement, pinch zoom, ProximityPrompt panels
UNVERIFIED: 2 players, host handoff, DataStore UpdateAsync outside Studio, BindToClose save
UNVERIFIED: balance: first wave survivable with kiting near the healer — numbers in Config.luau are a first guess
exit=0
```
게이트 증명: 회귀 주입 16/16 빨강 — `verifications/gate-proof.md`.

## 1차 이식(폐기)과 달라진 것
| 항목 | 1차 | 이번 |
|---|---|---|
| 카메라 | Scriptable 62°, 96~150 스터드 | Roblox 기본 카메라(줌 12~36) + 버튼으로 쿼터뷰(32, 50°) |
| 캐릭터 주변 | 광원 없음 | 플레이어 PointLight 28 · 아군 12 · 모닥불 48 · 치료사 30 · Future 조명 · Atmosphere 0.28 |
| 화살 | 0.12 Neon 막대, 패킷 뒤 표시 | 파트 화살 + Trail(LightInfluence 0) + 섬광 + 명중 파티클·소리 + 피해 숫자, 서버가 쏜 순간 모든 클라이언트가 그림 |
| 적·아군 | 클라이언트 상자 액터 | 서버 Humanoid 리그: Roblox 소유 Zombie(R6, 메시·신음)·Bat, 아바타 아군(R15) |
| 규모 | 웨이브 80 | 웨이브 10+3n, 동시 60 |
| 월드 | 단색 파트 | Terrain 분지 + Roblox 소유 모델 86개 + 목책·오두막·제단·동굴·문 |
| 조작 | 세로열 버튼·키 안내 | 핫바·ProximityPrompt·지면 탭, 점프 없음, 키 안내 없음 |

## 사용자에게 알릴 것
- 밸런스 수치는 전부 첫 추정이다(`Config.luau`). 원작처럼 「서서 쏘면 죽는」 난도를 의도했지만 Studio 에서 재 보기 전엔 모른다.
- 애니메이션 ID(R6 idle/walk), 화살 명중 소리 ID, 아바타 생성은 네트워크가 있어야 하고 Studio 에서 재생 여부를 봐야 한다. 실패해도 게임은 돈다(BlockRig·무음).
- 2012년 Zombie 모델엔 HumanoidRootPart 가 없어 빌더가 더했다. Studio 에서 좀비가 걷지 않으면 이 지점부터 본다.
- `roblox/AGENTS.md` 의 「gpt-6.1-sol 위임」은 사용자가 이 세션에서 해제했다(직접 구현). 조항 자체의 수정 여부는 사용자 결정.
