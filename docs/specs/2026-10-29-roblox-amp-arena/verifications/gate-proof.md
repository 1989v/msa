# 게이트 증명 — 회귀 주입 24건 전부 빨강 (2026-10-29)

프로젝트 사본(`dist` 제외)에 회귀를 하나씩 넣고 `tools/verify.py` 를 돌렸다. 원본은 건드리지 않았다. 스크립트는 세션 스크래치패드 `gate_proof.py`(레포에 두지 않음 — 검사용 임시 코드).

```sh
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 gate_proof.py roblox/amp-arena
```

| 주입 | 기대 게이트 | exit | 첫 빨간 줄 |
|---|---|---|---|
| A 카메라를 Scriptable 로 | default Roblox camera is never replaced | 1 | `FAIL default Roblox camera is never replaced: no CameraType anywhere in client scripts (KO shake uses Humanoid.CameraOffset)` |
| B 줌 범위 8~60 | camera zoom within references | 1 | `FAIL camera zoom 8~60 within public third-person references (default 12.5, brawlers 8~20)` |
| C 아바타 R15 로 | R6 avatars | 1 | `FAIL R6 avatars (GameSettingsAvatar R6) with procedural poses; Poser maps the six logical joints for both R6 and R15 rigs` |
| D Poser 를 RenderStepped 로 | procedural animation on Stepped | 1 | `FAIL procedural animation: Poser writes Motor6D.Transform every RunService.Stepped from shared Poses (no uploaded animation IDs required)` |
| E 키 안내 문자열 추가 | no web-style key hints | 1 | `FAIL no web-style key hints or jump buttons in client UI strings ([('Hud.client.luau', 'WASD'), ('Hud.client.luau', 'Space')])` |
| F 줍기를 E 키 바인딩으로 | pickup is not a bound key | 1 | `FAIL actions bound through ContextActionService with touch buttons titled ['약공', '강공', '기술', '대시'] + guard (keyboard, gamepad, touch); pickup is not a bound key` |
| G 넉백을 BodyVelocity 로 | one LinearVelocity per fighter | 1 | `FAIL knockback/launch/dash use one LinearVelocity per fighter toggled on and off (constraints replicate to the owning client; no BodyVelocity/ApplyImpulse)` |
| H 체력을 Items 가 직접 깎음 | Health written only by Combat | 1 | `FAIL Humanoid.Health is written only by Combat (damage/heal/KO) and Rigs (initial fill); Items, Projectiles and Bots route through Combat.applyHit/heal` |
| I Combat 시계를 os.clock 으로 | GetServerTimeNow clock | 1 | `FAIL MoveAt/FightAt use workspace:GetServerTimeNow() on both server and Poser (shared clock for pose phase)` |
| J 서버 모듈 순환(Combat → Items) | server require graph is a DAG | 1 | `FAIL server require graph is a DAG with Combat at the bottom (…)` |
| K OnServerEvent 가 validate 를 건너뜀 | every command passes Commands.validate | 1 | `FAIL exactly one RemoteEvent handler, every command passes Commands.validate (schema + token bucket) and buckets are forgotten on leave` |
| L 줍기 서버 거리 검사 제거 | bomb pickup re-checks distance | 1 | `FAIL bomb pickup re-checks distance and fighter state on the server (ProximityPrompt range is a client-side condition)` |
| M 봇 절벽 탐침 제거 | combat decisions live in Rules (bot edge step) | 1 | `FAIL combat decisions live in shared Rules (bot edge step, loadout phase, ally KO, launch landing, held escape, mash interval) and the server calls them` |
| N 봇 상한 20 | caps | 1 | `FAIL caps: bots ≤ 20, fighters ≤ 8, projectiles ≤ 40 (server Humanoid rigs and raycast steps stay bounded)` |
| O FallenPartsDestroyHeight 를 fallY 위로 | FallenPartsDestroyHeight ≤ min fallY − 100 | 1 | `FAIL FallenPartsDestroyHeight -30 ≤ lowest fallY -60 − 100 (ringout KO credited before the engine destroys the character)` |
| P 맵 스폰 팀을 전부 1 로 | two maps … both teams | 1 | `FAIL two maps in ServerStorage.Maps, each with ≥8 team-tagged spawns (both teams), crate spots, pads and FallY (cloned into Workspace per match)` |
| Q 액세서리 템플릿 하나 삭제 | accessory templates match Accessories.luau | 1 | `FAIL accessory templates match Accessories.luau (4), each a Part-built Model with PrimaryPart Handle and welded parts (no uploaded meshes)` |
| R 경직을 후딜+발동보다 길게 | rules spec (압박 ≠ 확정 콤보) | 1 | `…/tests/rules.spec.luau:10: 경직 < 후딜+다음 발동 jab` |
| S 남의 액세서리 허용 | rules spec (장비 배타) | 1 | `…/tests/rules.spec.luau:10: 스타일 외 액세서리는 맨손` |
| T 타격 포즈에서 팔을 안 뻗음 | rules spec (포즈) | 1 | `…/tests/rules.spec.luau:10: 타격 무브는 지속 구간에 팔·다리·몸을 뻗는다 quick2` |
| U 장비를 매치 중에도 받음 | combat decisions live in Rules (loadout phase) | 1 | `FAIL combat decisions live in shared Rules (bot edge step, loadout phase, ally KO, launch landing, held escape, mash interval) and the server calls them` |
| V 공유 모듈이 Vector3.new 사용 | rules spec 이 먼저 죽는다(CLI 엔 Vector3 가 없다) — 같은 성질을 다른 길로 잡은 것 | 1 | `…/tests/rules.spec.luau:7: error while running module` |
| W Commands 버스트 초과를 통과시킴 | rules spec (명령 빈도) | 1 | `…/tests/rules.spec.luau:10: 같은 순간 버스트 상한` |
| X 에셋 파일 변조 | embedded models are Roblox-owned | 1 | `FAIL 9 embedded models are Roblox-owned (creator id 1) with matching sha256 in provenance.json; 0 scripts in the raw files were stripped at build` |

24/24 RED, proof exit=0. 주입 전 원본은 exit=0(status.md 의 출력).

이 게이트가 재는 것은 구조(코드·XML)다. 포즈가 실제로 뻗어 보이는지, 넉백이 어떻게 느껴지는지, 잡기 Weld 가 두 클라이언트 사이에서 흔들리지 않는지는 Studio 에서 봐야 한다(UNVERIFIED 줄).
