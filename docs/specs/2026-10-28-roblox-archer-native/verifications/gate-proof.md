# 게이트 증명 — 회귀 주입 16건 전부 빨강 (2026-10-28)

프로젝트 사본(`dist` 제외)에 회귀를 하나씩 넣고 `tools/verify.py` 를 돌렸다. 원본은 건드리지 않았다. 스크립트는 세션 스크래치패드 `gate_proof.py`(레포에 두지 않음 — 검사용 임시 코드).

```sh
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 gate_proof.py <작업폴더>
```

| 주입 | 기대 게이트 | exit | 첫 빨간 줄 |
|---|---|---|---|
| A 카메라 기본값을 Scriptable 로 | default Roblox camera stays default | 1 | `FAIL default Roblox camera stays default: Scriptable appears only inside the quarter-view toggle and Custom is restored on exit` |
| B 쿼터뷰 거리 120 | camera distances within public references | 1 | `FAIL camera distances within public references: default zoom 12~36, quarter view 120 (max 44) — the first port used 96~150` |
| C 플레이어 광원 제거 | player character carries a PointLight | 1 | `FAIL player character carries a PointLight (range 28) and allies carry one too — brightness/visual quality itself is Studio-only` |
| D 화살 Trail 을 Beam 으로 | arrow visuals: Trail | 1 | `FAIL arrow visuals: Trail with LightInfluence 0 + Neon head + muzzle PointLight + impact ParticleEmitter + Sound (Weapons Kit pattern)` |
| E 키 안내 문자열 추가 | no web-style key hints | 1 | `FAIL no web-style key hints or jump buttons in client UI strings ([('Hud.client.luau', 'WASD')])` |
| F 동시 적 상한 120 | concurrent enemy cap | 1 | `FAIL concurrent enemy cap 120 ≤ 60 for server Humanoid rigs` |
| G 점프 복구(JumpPower 50) | no jump: CharacterJumpPower 0 | 1 | `FAIL no jump: CharacterJumpPower 0 (default touch jump button hides itself) and no custom jump GUI` |
| H 대낮 조명(ClockTime 12) | night lighting preset | 1 | `FAIL night lighting preset: ClockTime 12, Technology Future, Atmosphere + Bloom (visual result is Studio-only)` |
| I 에셋 파일 변조 | embedded models are Roblox-owned | 1 | `FAIL 16 embedded models are Roblox-owned (creator id 1) with matching sha256 in provenance.json; 3 scripts in the raw files were stripped at build` |
| J 빌더가 스크립트를 하나 더 넣음 | exactly 14 scripts | 1 | `FAIL exactly 14 scripts in the place and none inside embedded assets` |
| K 활잡이 가격 750 | rules spec (price) | 1 | `…/tests/rules.spec.luau:9` (고용 가격 단언) |
| L 웨이브 좀비 50+ | rules spec (wave cap) | 1 | `…/tests/rules.spec.luau:47` (12 웨이브까지 동시 상한 이하) |
| M 공유 모듈이 Roblox 서비스 사용 | shared modules never touch Roblox services | 1 | `…/tests/rules.spec.luau:9` — 게이트보다 먼저 규칙 검사가 죽었다(luau CLI 엔 `game` 이 없다). 같은 성질을 다른 길로 잡은 것이라 빨강은 맞지만 그 게이트 문구가 찍힌 건 아니다 |
| N 적 템플릿에서 Humanoid 제거 | NPC templates are Humanoid rigs | 1 | `FAIL NPC templates are Humanoid rigs with Motor6D joints (Roblox Zombie, Bat wings, R6 fallback) and allies come from HumanoidDescription avatars` |
| O 방업 최소 피해 0 | rules spec (damage floor) | 1 | `…/tests/rules.spec.luau:43` (방업 −1/레벨, 최소 1) |
| P 탑 간격 검사 삭제 | rules spec (spacing) | 1 | `…/tests/rules.spec.luau:56` (다른 탑과 간격) |

16/16 RED, proof exit=0. 주입 전 원본은 exit=0(status.md 의 출력).

이 게이트가 재는 것은 구조(코드·XML)다. 카메라가 실제로 가깝게 보이는지, 광원이 밝은지, 화살이 눈에 띄는지는 Studio 에서 눈으로 봐야 한다(UNVERIFIED 줄).

## 2차 — 플레이 피드백 반영 게이트 4종, 주입 4/4 빨강 (2026-10-29)

사용자가 Studio 에서 본 결함 넷(공격 모션 없음 · 좀비 한 줄 · 초반 과난이도 · 치료사 식별 불가)을 구조 게이트로 더했다. 스크립트는 스크래치패드 `gate_proof2.py`(레포에 두지 않음).

| 주입 | 기대 게이트 | exit | 첫 빨간 줄 |
|---|---|---|---|
| Q NPC 공격 모션 호출(`Rigs.attack`) 제거 | attack motion | 1 | `FAIL attack motion: NPC archers and zombies play an Action-priority attack track on the server, the local player plays toolslash on its own character when its arrow Fx arrives` |
| R 목적지 흔들림(`target.pos + ent.wobble`) 제거 | swarm spread | 1 | `FAIL swarm spread: waves enter from 4 bowl edges, per-enemy WalkSpeed jitter 0.25, destination wobble 6 studs re-rolled every few seconds` |
| S 치료 속도 20 → 6 | healer is a visible NPC | 1 | `FAIL healer is a visible NPC: HumanoidDescription avatar with name sign, green light, aura particles, tag Healer; heal 6 hp/s near it with per-second heal Fx` |
| T State 에서 튜토리얼 `hint` 제거 | upgrade-first opening | 1 | `FAIL upgrade-first opening: 300 starting gold, first wave at 75s, tutorial step 1 points at the attack-upgrade button and the HUD pulses it` |

R 은 첫 시도에서 **초록**이었다 — 게이트가 `ent.wobble` 문자열 존재만 봐서 할당문이 남아 있으면 통과했다. 목적지 식 `(target.pos + ent.wobble)` 자체를 보도록 고친 뒤 빨강. 안 물리는 게이트를 켰다고 하지 않았다.

4/4 RED, proof exit=0. 주입 전 원본 exit=0(status.md 2차 출력).

## 3차 — 2차 플레이 피드백 7건의 게이트, 주입 7/7 빨강 (2026-10-29 저녁)

점프 게이트는 뒤집었다(0 → Roblox 기본 50, 사용자 요청). 새 게이트 6종(탑 자립·미니맵·용병/병종 강화·스킬·적 종류·거구 보스). 스크립트 `gate_proof3.py`(스크래치패드, 사례당 치환 여러 개).

| 주입 | exit | 첫 빨간 줄 |
|---|---|---|
| U 점프를 다시 0 으로 | exit 1 | `FAIL jump is the Roblox default: CharacterJumpPower 50, server keeps it, no custom jump GUI (the default touch jump button serves) — user asked for jump on 2026` |
| V 탑 자가 건설 틱 제거 | exit 1 | `FAIL towers work alone: a placed site builds itself in 20s (carpenter speeds it up) and a completed tower fires its own ballista (range 34, damage 18) — garriso` |
| W 미니맵에서 적 점 제거 | exit 1 | `FAIL minimap: bowl-scaled frame with fixed sites, tagged allies/enemies/boss, towers, other players and the local player with heading` |
| X 근접 용병 AI 를 이름만 바꿔 우회 | exit 1 | `FAIL mercenaries and unit promotion: 2 hireable mercenaries (one melee with sword/shield gear and melee AI), 4 same-kind promotion rules driven from Config.COMB` |
| Y 질주 스킬 분기 이름 변경(동작 안 함) | exit 1 | `FAIL skills: 4 with server-side cooldowns (rain, dash, rally, volley), each with an Fx and a hotbar button showing the cooldown` |
| Z 질주 좀비 외형 분기 제거 | exit 1 | `FAIL enemy variety: 7 kinds in Config, 4 with distinct looks in Rigs (colors/scale/fire/metal/highlight) plus per-body scale jitter; runner/bomber/armored enter` |
| AA 거구 바위 Fx 이름 변경(클라이언트가 못 그림) | exit 1 | `FAIL brute is a mid-boss: 900 hp, scale 1.9 with red light, always-on head health bar, throws boulders with splash damage from range, announced every bossEvery ` |

7/7 RED, proof exit=0. 주입 전 원본 exit=0(status.md 3차 출력). X 는 함수 이름만 바꿔 호출까지 맞춘 「컴파일되는 회귀」다 — 문자열 존재가 아니라 그 이름의 정의·호출 둘 다를 보는 게이트라 빨강.
