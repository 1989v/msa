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
