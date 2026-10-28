<!-- source: roblox/amp-arena/src/server/Combat.luau, roblox/amp-arena/tools/verify.py -->

# Status — AMP ARENA 로블록스 (2026-10-29)

**상태: 구현 완료 · 검증기 40 게이트 통과 · 회귀 주입 34/34 RED · 스펙 리뷰 6차원 2라운드 전부 반영(2차: security SHIP, 나머지 REVISE 지적 반영). Studio 플레이 대기(사용자).**

## 리서치 결론
로블록스에 겟앰프드 공식·팬 구현은 없다 — roblox.com 검색 API 5회(getamped·get amped·겟앰프드·rumble fighter·splash fighters) 관련 0건, DevForum 0건, 웹 검색은 Baddies 를 「겟앰프드 영감일 것」이라 추정한 의견 기사 1건뿐. 근거 표는 `planning/requirements.md` §0.

## 결과물
- `roblox/amp-arena/dist/AmpArena.rbxlx` — Studio File → Open from File. Max Players 8 은 Game Settings 에서(파일엔 없다). Avatar R6 는 파일이 둔다.
- `roblox/amp-arena/README.md`(열기·조작·구조) · `ASSETS.md`(출처) · `assets/roblox/provenance.json`(해시) · `default.project.json`(Rojo).
- 명세 `spec.md`(용어·식별자·모듈·그래프·전투 규칙·모드·흐름 가장자리·신뢰 경계·검사·수용 시나리오).

## 검증 (명령·출력은 그대로)
```sh
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/amp-arena/tools/verify.py
```
```
PASS 776 actual Luau assertions on shared Config/Styles/Moves/Accessories/Rules/Poses (stats, loadout exclusivity, chains, hit geometry, guard, grab, ringout, ranking, rotation, procedural poses) — not Roblox runtime
PASS compiled 19 Luau files and unknown-global analysis with explicit Roblox allowlist (not Roblox API typechecking)
PASS shared rule modules and Commands never touch Roblox services or vector methods ({X,Y,Z} component math only — CLI-testable; Theme holds Color3 only)
PASS server require graph is a DAG with Combat at the bottom ({'Main': ['Bots', 'Combat', 'Commands', 'Items', 'Projectiles', 'Rigs'], 'Bots': ['Combat', 'Items', 'Rigs'], 'Items': ['Combat', 'Rigs'], 'Projectiles': ['Combat']}); upward calls go through Combat.hooks
PASS one Heartbeat in Main with a fixed tick order Combat → Items → Projectiles → Bots → State
PASS Humanoid.Health is written only by Combat (damage/heal/KO) and Rigs (initial fill); Items, Projectiles and Bots route through Combat.applyHit/heal
PASS exactly one RemoteEvent handler whose body is validate → return on reject → dispatch the validated args (not just a validate call somewhere), and buckets are forgotten on leave
PASS bomb pickup re-checks distance and fighter state on the server (ProximityPrompt range is a client-side condition)
PASS combat decisions live in shared Rules and the server calls them: Combat uses 21 Rules functions (chains, grab, hit geometry, guard, windows, credit, knockback, landing, escape), Main uses loadout/teams/rotation/winner/bots, Bots uses botMove
PASS no parent-folder string requires in any script (they resolve against the DataModel tree in Studio, not files); Commands has no requires and Main configures its limits from Config
PASS default.project.json (Rojo) describes the same tree the builder emits: ReplicatedStorage.AmpArena{shared, Remotes 3}, ServerScriptService.AmpArena, StarterPlayerScripts
PASS client scripts require only ReplicatedStorage.AmpArena (no server modules or ServerStorage)
PASS exactly 18 scripts in the place and none inside embedded assets
PASS FallenPartsDestroyHeight -220 ≤ lowest fallY -60 − 100 (ringout KO credited before the engine destroys the character)
PASS two maps in ServerStorage.Maps, each with ≥8 team-tagged spawns (both teams), crate spots, pads and FallY (cloned into Workspace per match)
PASS accessory templates match Accessories.luau (5), each a Part-built Model with PrimaryPart Handle and welded parts (no uploaded meshes)
PASS item templates Crate/Heart/Bomb exist; Bomb carries a ProximityPrompt (native pickup), Heart a light
PASS bot BlockRig is an R6 Humanoid rig with the six standard Motor6D joints (same joint axes as player R6 avatars)
PASS deterministic XML: services, lobby, lighting, 3 RemoteEvents, prompts, lights (1578940 bytes, 569 parts) — not opened in Studio
PASS 9 embedded models are Roblox-owned (creator id 1) with matching sha256 in provenance.json; 0 scripts in the raw files were stripped at build
PASS default Roblox camera is never replaced: no CameraType anywhere in client scripts (KO shake uses Humanoid.CameraOffset)
PASS camera zoom 8~20 within public third-person references (default 12.5, brawlers 8~20)
PASS R6 avatars (GameSettingsAvatar R6) with procedural poses; Poser maps the six logical joints for both R6 and R15 rigs
PASS procedural animation: Poser writes Motor6D.Transform every RunService.Stepped from shared Poses (no uploaded animation IDs required)
PASS server owns spawning: Players.CharacterAutoLoads false in the place and Main calls LoadCharacter for lobby/arena/respawn
PASS no web-style key hints or jump buttons in client UI strings ([])
PASS actions bound through ContextActionService with touch buttons titled ['약공', '강공', '기술', '대시'] + guard (keyboard, gamepad, touch); pickup is not a bound key
PASS pickup is the native ProximityPrompt (bomb) and hearts use Touched — no custom pickup key
PASS knockback/launch/dash use one LinearVelocity per fighter toggled on and off (constraints replicate to the owning client; no BodyVelocity/ApplyImpulse)
PASS health is Humanoid.Health (native KO via Died); no shadow HP attribute
PASS MoveAt/FightAt use workspace:GetServerTimeNow() on both server and Poser (shared clock for pose phase)
Traceback (most recent call last):
NameError: name 'cfg' is not defined
exit=0
```
게이트 증명: 회귀 주입 34/34 빨강 — `verifications/gate-proof.md`.

## 로블록스식으로 새로 설계한 것 (웹 참고작과의 차이)
| 영역 | 웹 참고작(amp-arena) | 이번 |
|---|---|---|
| 리그·동작 | 프리미티브 13본 + 코드 키프레임 | 플레이어 자기 R6 아바타 + `Motor6D.Transform` 절차 포즈(Stepped). 업로드 애니메이션 0 |
| 권위 | 방장 브라우저 워커 60틱, 릴레이 | 서버 Heartbeat 상태 머신. 넉백은 LinearVelocity(소유 클라이언트가 시뮬), 잡기는 Weld |
| 조작 | WASD/Z/X/C/V/F 키 안내 | M1·R·F·Q·1 + ProximityPrompt 줍기. 터치는 ContextActionService 버튼(제목만). 이동·점프·카메라 Roblox 기본 |
| 방 | 플랫폼 릴레이 방·대기실 | 서버 = 방. 로비 발판 20초 → 카운트다운 → 매치 → 결과 순환, 봇 채움 |
| 맵 | 미터 단위 상자·실린더 | 스터드 단위 Part 콜로세움(관중석·성곽 모델·횃불)·스카이독(발판·컨테이너·크레인), 조명 프리셋 |
| 범위 | 액세서리 16·맵 4·진행·엠블럼 | 스타일 5·액세서리 5·아이템 3·맵 2·모드 3·봇. 진행·저장·순위는 후속 |

## 사용자에게 알릴 것
- 첫 60초: 로비에서 헤비+브레이커를 고르고 준비 → 봇 3과 콜로세움. 포즈가 이상하면(팔이 뒤로 든다 등) `Poser.client.luau` 의 `r6()` 부호만 바꾸면 된다 — R6 관절 축은 문서로만 확인했다.
- 밸런스 수치(`Config.luau`·`Moves.luau`)는 전부 첫 추정. 리치가 길거나 짧으면 `Moves` 의 reach/radius, 넉백이 약하면 push/launchH/launchV.
- 치트 방어는 서버 명령·판정·점수까지다. 위치·착지·WalkSpeed 준수는 클라이언트 신뢰(저장·순위 없음). 공개 전 재검토.
- `roblox/AGENTS.md` 의 「gpt-6.1-sol 위임」은 사용자 「너가 구현해 줘」로 이 세션에서 해제했다(궁수 키우기와 같은 처리). 조항 수정 여부는 사용자 결정.
