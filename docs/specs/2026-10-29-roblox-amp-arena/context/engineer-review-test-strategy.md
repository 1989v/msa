# Engineer Review — test-strategy (2026-10-29)

대상: `docs/specs/2026-10-29-roblox-amp-arena/` (spec.md · planning/requirements.md · planning/test-quality.md · tasks.md · context/open-questions.yml)

## Seed Discovery
- 스펙 4종 + 동반 문서 읽음. 스펙에 「Acceptance Criteria」 절은 없어 `spec.md:40-63` 의 규칙·네트워크·월드 불릿을 AC 로 삼았다.
- 표준: `roblox/AGENTS.md:11`(코드 검사 수로 게임 경험 검증을 대신하지 않는다), `docs/research/2026-10-26-roblox-development/README.md:22-24`(검증은 네이티브 조건을 잰다 · 회귀 주입 뒤에만 「켰다」), 같은 문서 `:106-115`(검사별로 알 수 있는 것 구분). `docs/standards/test-rules.md` 는 JVM 용이라 제외.
- 선행작: `roblox/archer-command/tests/rules.spec.luau`, `roblox/archer-command/tools/verify.py`, `docs/specs/2026-10-28-roblox-archer-native/verifications/gate-proof.md`, 같은 폴더 `status.md`.
- 코드 근거: `roblox/amp-arena/src/shared/{Config,Styles,Accessories,Moves}.luau` 가 이미 있다(구현 진행 중). Roblox 전역(`Vector3`·`CFrame`·`Color3`) 사용 0건 — `Styles.luau:3` 「색은 CLI 에서도 읽히도록 {r,g,b}」, `Accessories.luau:3` 「grip 오프셋 {x,y,z}」. CLI 실행 전제는 지켜지고 있다.

## AC → 테스트 매핑
| AC (spec.md) | 계층 | 매핑 |
|---|---|---|
| L41 사슬: 후딜 뒤 다음 타 · 약공 중 강공 → 피니시 | unit Rules | test-quality.md:5 ✔ |
| L41 밀착 약공 = 잡기 우선 | unit Rules | :5 「잡기 성립」만. 우선순위 단언 없음 △ |
| L41 가드 직후 0.25초 반격기 · 대시 직후 0.3초 대시 공격 | 순수(상수 `Config.luau:9-10`) | **없음** ✗ |
| L42 히트 기하 · 가드 정면 180° 피해 0 · 게이지 −×4 | unit Rules | :5 ✔ |
| L42 팀전에서도 아군이 맞는다 | 순수 | **없음** ✗ |
| L43 피해 = 내림(기본×근력×방어) | unit Rules | :5 ✔ |
| L43 경타 HITSTUN / 강타 LAUNCHED→DOWN→GETUP 전이 | Combat(서버) | Studio UNVERIFIED(spec.md:69) — 전이표가 Rules 에 없어 CLI 불가 △ |
| L43 같은 공격자 4히트째 넉백 ×1.5 | 순수(`Config.luau:13`) | **없음** ✗ |
| L44 게이지 0 → STUN · 방패 크러시 면역 | unit Rules | :5 「크러시」 ✔ (0 경계 단언은 명시 없음) |
| L45 잡기 성립(상태·거리·정면 60°) | unit Rules | :5 ✔ |
| L45 HELD 2초 · 6연타 탈출 · 대검 잡기 불가 | 순수(`Config.luau:11`, `Accessories.luau:28 twoHanded`) | **없음** ✗ |
| L47 대시 쿨다운 · 공중 대시 스피드스타만 | unit Styles | :6 에 없음 △ |
| L48 링아웃 Y < fallY | unit Rules | :5 ✔ |
| L48 KO 크레딧 3초 안 마지막 타격자, 없으면 −1 | 순수(`Config.luau:13 koCreditSeconds`) | **없음** ✗ |
| L48 FallenPartsDestroyHeight = fallY − 100 | 빌더 산출물 | verify 게이트 목록(spec.md:67)에 **없음** ✗ |
| L14 4 미만이면 봇이 채운다 / L67 봇 상한 ≤ 7 | 순수(`Config.luau:34 fillTo·max`) | 상한만 게이트, 채움 규칙 없음 △ |
| L50 봇 절벽 앞 2.5 스터드 멈춤 | Bots(서버 Raycast) | **없음** ✗ (웹판 교훈 `amp-arena/shared/test/botedge.test.ts:1-3`) |
| L53 명령 검사: enum · Vector3 유한 · 초당 20 | Commands(Roblox API 없음, spec.md:32) | :5 「입력 정리」가 Rules 로 적혀 모듈 불일치, 빈도 제한 단언 없음 △ |
| L53-56 Remotes 3 · Attribute 이름 | component | spec.md:67 ✔ |
| L59-63 맵 2 · 템플릿 5 · BlockRig Motor6D 6 · 결정성 | component | test-quality.md:8 ✔ |
| 모드 3 승자·동점 | unit Rules | :5 ✔ |
| L66 ≥ 40 단언 · L68 회귀 주입 ≥ 12 RED | gate | tasks.md:8 ✔ (주입→게이트 대응표 없음, F7) |

## 체크리스트 판정
| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트 ≥ 1 | ✗ 순수 상수가 이미 있는 규칙 7건이 계획에 없다 (F1·F4·F5) |
| 2 | 계층 배정 적절 | △ 상태 전이가 Combat(Roblox API)에 남으면 게임의 핵심이 전부 Studio 수동이 된다 (F2) |
| 3 | 목 경계 명확 | △ luau CLI 엔 목이 없다 — 유일한 이음새는 순수성인데 `{X,Y,Z}` 셈·시계 주입 규약이 문서에 없다 (F3·F4) |
| 4 | 테스트 데이터 전략 | △ 파이터 상태 픽스처 방식 미기재, 전수 불변식은 실제 표를 순회해야 한다 (F8) |
| 5 | 부정·경계 케이스 | △ NaN·뒤·동점은 있으나 빈도 초과·fallY 경계·게이지 0·provenance 공집합이 없다 (F5·F6) |
| 6 | 이름 규약 | ✔ `tests/rules.spec.luau` · `tools/verify.py` · `verifications/gate-proof.md` · PASS 문구에 「무엇이 아닌지」 · UNVERIFIED 줄 — 선행작과 같다 |

## Findings

### F1 (Check 1·5) 순수 규칙 7건이 테스트 계획에 없다
- 근거: `spec.md:41`(반격기 0.25초·대시 공격 0.3초), `:42`(팀전 아군 피격), `:43`(4히트째 ×1.5), `:45`(HELD 2초·6연타·대검 잡기 불가), `:47`(공중 대시 스피드스타만), `:48`(KO 크레딧 3초/자멸 −1), `:14`(봇 채움). 상수는 전부 `roblox/amp-arena/src/shared/Config.luau:9-13,34` 에 있고 `Accessories.luau:28` 에 `twoHanded = true` 가 있다. `planning/test-quality.md:5-7` 에는 어느 행에도 없다.
- 왜 중요한가: 「팀전에서도 아군이 맞는다」 같은 결정은 구현자가 「친절하게」 팀 검사를 넣어 조용히 뒤집기 쉽고, Studio 에서 눈으로는 안 보인다.
- 수정안: test-quality.md Rules 행에 추가 — 반격 창 안/밖(0.24/0.26) · 대시 공격 창 · 4히트째 배율(3히트째는 1.0) · KO 크레딧(2.9초 전 타격 → 가해자, 3.1초 → −1) · 탈출 카운트(5 → 유지, 6 → 탈출) · `twoHanded` 면 잡기 거부 · 아군 표적도 히트 · `botsNeeded(1)=3, (4)=0, (0)=4` · 공중 대시 허용 스타일. 단 이 결정들이 Rules 에 있어야 한다 → F2.

### F2 (Check 2·3) 상태 전이의 주인이 두 모듈에 걸쳐 있어 CLI 로 잴 수 없다
- 근거: `spec.md:27` Combat = 「상태 머신 · 히트 판정 · 피해 · 넉백 · 슈퍼아머 · 가드 게이지 · 쿨다운」(Humanoid·LinearVelocity·Weld), `spec.md:24` Rules = 「피해 · 가드 · 사슬 · 잡기 성립 · 히트 기하」. 「피해」「가드」가 양쪽에 있다. `test-quality.md:10` 은 경직·넉백·다운을 e2e(사용자)로만 둔다. `docs/research/2026-10-26-roblox-development/README.md:110` 은 단위 테스트가 「규칙·상태 전이」를 알 수 있는 검사라고 적는다.
- 왜 중요한가: luau CLI 엔 목 프레임워크가 없다. Combat 에 들어간 결정은 전부 Studio 수동이고, 이 게임의 핵심은 경제가 아니라 전투 상태 머신이다(선행작은 경제가 핵심이라 같은 분할이 통했다).
- 수정안: test-quality.md 에 경계 규칙 한 줄 — 「결정은 Rules(순수 테이블 in → 결과 out), Combat 은 Roblox 인스턴스에 적용만」. 최소 목록: `Rules.acceptIntent(state, kind, ctx)` · `Rules.resolveHit(victim, move, streak, guardOn, facingDeg)` → `{next, damage, gauge, knockMult}` · `Rules.heldEscape(count)` · `Rules.koCredit(lastHit, now)` · `Rules.botsNeeded(players)`. 선행작 모양 그대로다: `roblox/archer-command/src/shared/Rules.luau:106-117` 이 평범한 테이블을 받고, `tests/rules.spec.luau:15-25` 가 그걸 돌린다.

### F3 (Check 3) `{X,Y,Z}` 셈 규약이 문서에 없다
- 근거: `spec.md:24` 히트 기하·링아웃, `spec.md:53` 「Vector3 유한」. luau CLI 엔 `Vector3` 전역이 없다 — 선행작은 `tests/rules.spec.luau:1-2` 에서 `V(x,y,z)` 표로 대신하고 `Config.luau:4-7` 이 양쪽 모드 `vec` 을 두며 `Rules.luau:99-102` 는 성분 연산만 쓴다. `gate-proof.md:23` M 주입이 보여 주듯 공유 모듈이 Roblox 전역을 만지면 게이트보다 먼저 스펙이 죽는다. amp-arena 공유 4파일은 아직 지키고 있지만(`Accessories.luau:3,13`) Rules·Poses 는 아직 없고 규약이 적힌 곳도 없다.
- 수정안: test-quality.md 에 「Rules·Commands 는 `{X,Y,Z}` 표 또는 숫자만 받고 `.Magnitude`·`.Unit`·`:Dot` 를 쓰지 않는다. 변환은 Combat 이 한다」. verify.py 의 「shared modules never touch Roblox services」 게이트(선행작 `verify.py:43`)를 `Vector3\.new|CFrame|\.Magnitude|:Dot\(` 까지 넓히고 Theme 만 예외.

### F4 (Check 1·2) Commands 가 시험 대상에서 빠졌고 「입력 정리」의 주인이 어긋난다
- 근거: `spec.md:32` Commands = 「명령 모양 검사 · 토큰 버킷, Roblox API 없음」, `spec.md:53` 「초당 20」. `test-quality.md:5` 는 입력 정리를 Rules 행에 적었고 Commands 행은 없다. 선행작 `roblox/archer-command/src/server/Commands.luau:26-29` 는 `os.clock()` 을 직접 읽어 버킷을 결정적으로 시험할 수 없었고, `:5-6` 의 `typeof(v) ~= "Vector3"` 는 CLI 에서 항상 거짓이다.
- 수정안: Commands 행 추가 — 미지 이름 → UNKNOWN · enum 밖 → SCHEMA · 같은 초 21번째 → RATE · 1초 뒤 회복. 시계는 인자로 넣는다(`Commands.validate(player, name, args, now)`). Vector3 판정은 `{X,Y,Z}` 유한수 검사로 두고 Roblox 쪽 `typeof` 분기는 Combat/Main 에 둔다.

### F5 (Check 5) 게이트 목록에서 빠진 구조 조건 둘
- (a) `spec.md:48` 「`FallenPartsDestroyHeight` 는 fallY 보다 100 아래」. `Config.luau:29-30` 엔 fallY(−60/−40)만 있고 파괴 높이는 빌더가 정한다. `spec.md:67` 게이트 목록에 없다. 파괴 높이가 fallY 위면 캐릭터가 링아웃 판정 전에 사라져 KO 크레딧이 증발한다. 수정안: rbxlx 의 Workspace float 를 읽어 `≤ min(fallY) − 100` 단언(선행작 `verify.py:84-87` 이 StarterPlayer float 를 같은 식으로 읽는다).
- (b) `spec.md:50` 봇 절벽 2.5 스터드, `Config.luau:34 edgeProbe = 2.5`. 웹판에서 자멸이 전체 사망의 36%, 「제일 컸다」(`amp-arena/docs/GDD.md:228`, `shared/test/botedge.test.ts:1-3`). 테스트 행도 게이트도 없고 Bots 는 Raycast 라 CLI 불가. 수정안: 레이캐스트 결과를 bool 로 받는 `Rules.botStep(intent, footingAhead)` 를 두어 `footingAhead=false` 면 전진·대시 의도가 지워지는지 단언 + verify.py 게이트는 Bots.luau 의 이동 결정 식 자체(`Rules.botStep(` 호출과 `edgeProbe` 사용처)를 본다 — 토큰 존재만 보면 `gate-proof.md:43` R 처럼 초록이 난다.

### F6 (Check 5) 「에셋 provenance(있으면)」는 공집합에서 공허하게 통과한다
- 근거: `spec.md:67` 「에셋 provenance(있으면)」. 그런데 `spec.md:60` 이 이미 「횃불 · Roblox 소유 성벽 모델」을 계획한다. 선행작 게이트는 `verify.py:75` 처럼 파일 수 == 대장 수를 세어 0 == 0 도 통과한다.
- 수정안: 조건을 뒤집는다 — Workspace/ServerStorage 의 Model 중 build.py 가 직접 조립하지 않은 것(이름 집합으로 식별)은 **전부** provenance 레코드가 있어야 FAIL 이 아니다. 임베드 0 이면 PASS 가 아니라 INFO 로 찍는다.

### F7 (Check 6 · 게이트 정직성) 주입 → 기대 게이트 대응표가 미리 없다
- 근거: `spec.md:68` 「회귀 주입 ≥ 12 건 전부 RED」만 있고 어느 주입이 어느 FAIL 줄을 내야 하는지 없다. 선행작 `gate-proof.md:9-26` 은 표로 적었고, 그 덕에 M(게이트 전에 스펙이 죽음)·R(문자열 존재만 봐서 초록) 두 함정이 드러났다. `spec.md:67` 의 「Poser 가 Stepped + Transform」「넉백 LinearVelocity」「Health 는 Humanoid」는 토큰 모양 검사가 되기 쉽다.
- 수정안: test-quality.md 에 주입 표를 먼저 쓴다(주입 → 기대 FAIL 문구). 주입은 삭제가 아니라 **틀린 API 로 바꾸기** — `Stepped`→`Heartbeat`, `Transform =`→`C0 =`, `LinearVelocity`→`AssemblyLinearVelocity =`, `Humanoid.Health`→자체 hp Attribute, `ProximityPrompt`→클라이언트 E 바인딩, `edgeProbe` 사용처 제거. 게이트는 사용처 본문(regex 로 함수 몸체 추출, 선행작 `verify.py:79-82,121-124` 방식)을 본다. tasks.md:8 에 산출물 `verifications/gate-proof.md` 와 status.md 의 verify 출력 원문(선행작 `status.md:55-84`)을 명시.

### F8 (Check 4) 픽스처 방식이 없고 전수 불변식의 근거가 정해지지 않았다
- 근거: `test-quality.md:5` Rules 시나리오는 파이터 상태(위치·정면·상태·스타일·액세서리·게이지)를 요구하는데 만드는 방식이 없다. `:6-7` 「모든 사슬의 무브가 존재 · 경직 < 후딜+다음 발동 · 모든 무브에 포즈」는 손으로 적은 목록을 돌면 검사가 자기 사본을 재게 된다.
- 수정안: `rules.spec.luau` 안에 `V()` 와 `fighter(overrides)` 인라인 팩토리 둘만(선행작 `rules.spec.luau:2,15` 의 `V`·`Rules.newEconomy()` 와 같은 크기 — 별도 fixtures 디렉토리 없음). 전수 불변식은 `Moves.DEF`·`Styles`·`Accessories.DEF` 실제 표를 순회해 사슬 id 가 `Moves.DEF` 에 있는지, `hitstun < recovery + next.startup` 인지, `projectile = true` 면 투사체 스펙이 있는지(`Accessories.luau:13,23`)를 센다. Poses 「뻗는다」는 수치로: 지속 구간 샘플에서 `rs` 또는 `rh` 각도의 절댓값이 idle 대비 ≥ N° — N 을 적는다.

### 사소
- `test-quality.md:9` 「§6 목록」은 requirements.md §6 를 가리키는데 항목별 게이트는 `spec.md:67` 에 있다. 링크를 spec.md 로.
- `Config.luau:10 angleDeg = 180` vs `Accessories.luau:18 guardAngle = 150` — Rules 가드 테스트에 액세서리 각 override 한 줄.

## 결론
계층 배정과 이름 규약, 게이트 증명 방식은 선행작과 같아 문제없다. 격차는 「상수는 이미 Config 에 있는데 그것을 재는 행이 없다」(F1·F5)와 「결정이 Combat 으로 흘러가면 CLI 로 잴 길이 사라진다」(F2·F3·F4)에 모여 있고, 전부 구현 전에 test-quality.md 와 Rules 의 함수 목록을 고치면 닫힌다. BLOCK 근거(스펙 결정 + 문서 위반 쌍)는 없다.

_(1차 판정: REVISE)_

---

## Round 2 (2026-10-29)

대상 추가: `planning/test-quality.md`(개정), `roblox/amp-arena/tests/rules.spec.luau`(764 단언), `src/shared/Rules.luau`, `src/server/Commands.luau`, `src/server/Combat.luau`, `src/server/Bots.luau`, `tools/verify.py`(게이트 38), `verifications/gate-proof.md`(24 RED), 검증기 출력 `/tmp/amp_verify.txt`(PASS 38 · INFO 1 · UNVERIFIED 8, exit 0).

### 1차 이슈 해소 확인
| 1차 | 상태 | 근거 (file:line) |
|---|---|---|
| F1 순수 규칙 7건 | 해소 — 1건 잔여 | 반격 창 `rules.spec.luau:111` · 대시 공격 창 `:112` · 아군 피격 `:117` · 4히트째 `:86`(호출 `Combat.luau:159`) · HELD 2초 `:121` · 6연타 `:109`(`Combat.luau:282`) · 대검 잡기 불가 `:24`(`Combat.luau:310`) · 공중 대시 `:120`(`Combat.luau:324,412`) · KO 크레딧 `:100`(`Combat.luau:398`) · 봇 채움 `:114`(`Main.server.luau:193`). 잔여: `Rules.canHit` 는 호출처가 없다 → R2-1 |
| F2 상태 전이 | **수용** | `spec.md:73` 「상태 머신의 전이 자체는 Combat 에 있다(Studio 확인 대상)」로 명시. 논리가 있는 결정(`launchLanded`·`heldEscape`·`mashAccepted`·`counterOpen`·`dashAttackOpen`, `Rules.luau:218-227`)은 빠져 나왔고, Combat 에 남은 것은 타이머 만료 전이(`Combat.luau:353-374`)와 상태별 의도 수용표(`:240-316`)다. 1차가 제안한 `acceptIntent`/`resolveHit` 는 없지만 `test-quality.md:12` e2e 행과 `verify.py:204` UNVERIFIED 줄이 받는다. 수용 조건 하나는 「사소」에 적었다 |
| F3 `{X,Y,Z}` 규약 | 해소 | `test-quality.md:14` 규약 문장 · `verify.py:43` regex 가 `Vector3\.new|CFrame|\.Magnitude|:Dot\(|\.Unit\b` 까지 보고 Commands 를 포함(`:42`) · `gate-proof.md:32` V(스펙이 먼저 죽는 성질을 명시) |
| F4 Commands | 해소 | `test-quality.md:8` 행 · `Commands.luau:25-26` `validate(player, name, args, now)` 시계 주입 · `rules.spec.luau:123-145` UNKNOWN/SCHEMA/RATE/회복/forget · `gate-proof.md:21,33` K·W |
| F5a FallenPartsDestroyHeight | 해소 | `verify.py:97-99` Workspace float 읽어 `≤ min fallY − 100` · `gate-proof.md:25` O · `/tmp/amp_verify.txt:13` |
| F5b 봇 절벽 | 해소 | `Rules.luau:233-237 botMove` · `rules.spec.luau:115` · `Bots.luau:60` 결정식 · `verify.py:70` 이 결정식 문자열 그대로를 대조(토큰 존재가 아님) · `gate-proof.md:23` M |
| F6 provenance 공집합 | 해소 | `verify.py:131-135` 파일마다 레코드·creatorId 1·sha256 일치 + `len >= 5` 하한 · `gate-proof.md:34` X |
| F7 주입 대응표 | 해소 — 잔여 2 | `gate-proof.md:9-34` 24행, 주입이 「틀린 API 로 바꾸기」(A·D·G·H·I). 잔여: 게이트 38 중 15 에 RED 행이 없다 → R2-4 · `gate-proof.md:36` 가 가리키는 status.md 가 없다 → 사소 |
| F8 픽스처·전수 불변식 | 해소 — 잔여 1 | `rules.spec.luau:2` `V()` 하나, Rules 함수가 원시값을 받아 파이터 팩토리가 필요 없어졌다 · `:44-56` 실제 `Styles.DEF`·`Accessories.DEF` 순회 · 포즈 「뻗는다」 수치 `:157`(60°/30°). 잔여: 압박 불변식 `:58-64` 가 스타일 약공 사슬만 돈다 → R2-3 |
| 사소 2 | 해소 | `test-quality.md:11` 링크를 spec §검사로 · `rules.spec.luau:82` guardAngle 150 override |

### 남은 것

#### R2-1 (Check 3·1) `Rules.canHit` 는 정의·단언됐지만 아무도 부르지 않는다
- 근거: `Rules.luau:239` 정의, `rules.spec.luau:117` 단언, `Combat.luau:191-203` hitScan 루프에 팀 분기가 없다(현재 동작은 스펙대로 맞는다). `verify.py:70` 「서버가 부름」 게이트 목록에 `canHit` 가 없다.
- 왜 중요한가: hitScan 에 `if V.team == F.team then continue end` 한 줄을 넣어도 764 단언·38 게이트가 전부 초록이다. 1차 F1 이 걱정한 「친절한 팀 검사」가 그대로 통과한다 — 검사가 대상이 아니라 자기 사본(상수 `true`)을 재고 있다.
- 수정안: `Combat.luau:194` 의 continue 조건에 `or not Rules.canHit(F.team, V.team)` 을 붙이고 `verify.py:70` 목록에 `'Rules.canHit(F.team, V.team)' in combat` 을 더한다. 대안은 함수·단언을 지우고 게이트가 hitScan 본문에 `.team` 이 없음을 보는 것인데, `spec.md:73` 「결정은 Rules」와 맞는 쪽은 전자다.

#### R2-2 (Check 5) 「결정 함수가 Rules 에 있고 서버가 부름」 게이트가 스펙 목록보다 좁다
- 근거: `spec.md:73` 는 11 항목(사슬·잡기 성립·히트 기하·가드·연타 탈출·반격/대시 공격 창·띄움 착지·봇 걸음·봇 수·아군 KO·장비 단계)을 Rules 결정으로 적고 `spec.md:130` 이 그것을 게이트라 한다. `verify.py:70` 은 6 항목(botMove·loadoutPhaseOpen·allyKo·launchLanded·heldEscape·mashAccepted) + `:179` botsNeeded 만 본다. 호출 자체는 다 있다(`Combat.luau:139 guardBlocks`, `:159 knockbackMult`, `:197 hitTest`, `:210,222 canGrab`, `:298 counterOpen`, `:310 canGrabWith`, `:311 dashAttackOpen`, `:312 firstMove`, `:348 chainNext`, `:398 koCredit`) — 게이트가 안 잡을 뿐이다.
- 왜 중요한가: 반격 창을 `t < F.counterUntil + 1` 로 인라인해도 spec 은 Rules 를 재니 초록, 게이트는 그 함수를 안 보니 초록. 스펙이 「게이트」라 부르는 것과 게이트가 재는 것이 다르다.
- 수정안: `verify.py:70` 의 문자열 목록에 위 10 호출(`Rules.chainNext(`·`Rules.firstMove(`·`Rules.canGrab(`·`Rules.hitTest(`·`Rules.guardBlocks(`·`Rules.counterOpen(`·`Rules.dashAttackOpen(`·`Rules.koCredit(`·`Rules.knockbackMult(`·`Rules.canGrabWith(`)을 더한다. 덤으로 가드 크러시·방패 면역 분기는 `Combat.luau:144-145` 에 있고 단언이 없다(`test-quality.md:5` 「크러시」에 대응하는 것은 `rules.spec.luau:83` 산술뿐, `Accessories.luau:18 crushImmune` 은 어디서도 안 센다). `Rules.guardAfterBlock(guard, cost, crushImmune)` → `{guard, crushed}` 로 빼면 단언 대상이 된다.

#### R2-3 (Check 1) 압박 불변식이 스타일 약공 사슬만 돈다
- 근거: `rules.spec.luau:58-64` 는 `Styles.ORDER` 의 `light` 인접쌍만 검사한다. `Accessories.DEF` 의 light(gs1→gs2 …)·heavy 사슬과 스타일 heavy 사슬은 안 본다. `test-quality.md:6` 「경직 < 후딜+다음 발동」은 `Moves·Accessories·Styles` 행에 있어 모든 사슬을 뜻한다. `gate-proof.md:28` R 도 jab(스타일 사슬)에만 주입했다.
- 수정안: `:44-47` eachChain 과 같은 식으로 Styles·Accessories 의 light·heavy 전부 인접쌍을 돌린다(단언 수가 늘고 R 주입을 액세서리 사슬에 한 번 더).

#### R2-4 (Check 5 · 게이트 정직성) 게이트 38 중 15 에 RED 행이 없다
- 근거: `gate-proof.md:9-34` 24 행이 덮지 않는 게이트 — `verify.py:61`(Heartbeat 하나·틱 순서) · `:73`(Rojo 대조) · `:77`(클라이언트 참조) · `:89`(스크립트 수) · `:120`(아이템 템플릿) · `:123`(BlockRig) · `:150`(CharacterAutoLoads) · `:160`(ProximityPrompt) · `:165`(그림자 HP 없음) · `:170`(착지·Weld·cleanup) · `:174`(라운드 4단계) · `:184`(Guard 속성 정수 변화 시만) · `:186`(명령 모양) · `:188`(아바타 유지) · `:193`(조명). `docs/research/2026-10-26-roblox-development/README.md:24` 「회귀를 주입해 빨간불을 본 뒤에만 켰다」는 게이트마다다. 스펙 하한(`spec.md:131` 24)은 넘겼다.
- 수정안: 토큰 모양이라 공허 통과 위험이 큰 다섯만이라도 주입 행을 더한다 — Bots 에 `Heartbeat:Connect` 하나 더(`:61`) · `SetAttribute("Guard"` 를 매 틱(`:184`) · `SetAttribute("Hp"` 추가(`:165`) · `CharacterAutoLoads` true(`:150`) · cleanup 을 둘로 쪼개기(`:170`).

#### 사소
- `gate-proof.md:36` 「주입 전 원본은 exit=0(status.md 의 출력)」 — status.md 가 스펙 폴더에도 `roblox/amp-arena/` 에도 없다(`tasks.md:5` 미완). 기준선 출력은 레포 밖 `/tmp/amp_verify.txt` 뿐이다. status.md 를 쓰면서 verify 출력 원문을 넣거나, 그 전까지 문구를 고친다.
- `tasks.md:8` 「게이트 증명 ≥ 12 RED」 — `spec.md:131` 은 24 이고 산출물 이름 `verifications/gate-proof.md` 가 없다(1차 F7 수정안).
- `rules.spec.luau:100` koCredit 단언이 12/14 라 `koCreditSeconds ∈ [2, 4)` 어디서든 초록이다 — 12.9/13.1 로. `Config.GUARD.counterWindow 0.25`·`Config.DASH.attackWindow 0.3` 은 `Combat.luau:141,264` 에서만 쓰이고 단언이 없다 — `:121` 처럼 Config 값 단언 한 줄.
- F2 수용 조건: `verify.py:204` UNVERIFIED 문구에 「상태 전이표(hitstun→idle·down→getup·held 타임아웃)·상태별 의도 수용표」를 적는다. 지금은 「guard/counter window, chain buffering」만 있어 README 「검증하지 않는 것」(`README.md:47`)이 상태 머신을 빠뜨린다.

### 체크리스트 (2차)
| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 AC 에 테스트 ≥ 1 | △ 압박 불변식 범위(R2-3) · 크러시 면역(R2-2 덤) |
| 2 | 계층 배정 적절 | ✔ F2 수용 — 추출 경계가 스펙에 명시됐고 잔여는 UNVERIFIED |
| 3 | 목 경계 명확 | △ 규약·게이트는 됐으나 `canHit` 가 경로 밖(R2-1) |
| 4 | 테스트 데이터 전략 | ✔ 원시값 인자 + `V()` 하나, 실제 표 순회 |
| 5 | 부정·경계 케이스 | △ 게이트가 스펙 목록보다 좁다(R2-2) · RED 없는 게이트 15(R2-4) · koCredit 경계 |
| 6 | 이름 규약 | ✔ |

### 결론
1차 8건 중 F2 는 스펙 명시로 수용, 나머지 7건은 file:line 으로 해소 확인. 남은 4건은 전부 「검사가 대상에 물려 있는가」 쪽이고 변경은 `Combat.luau` 한 줄·`verify.py:70` 문자열 목록·spec 루프 범위·주입 다섯 수준이다. BLOCK 쌍(스펙 결정 + 코드 위반)은 없다. 2라운드 상한이므로 다음 라운드는 SHIP 이어야 하고, 위 4건은 한 번에 닫힌다.

VERDICT: REVISE
