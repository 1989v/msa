# Implementation Review — AMP ARENA 로블록스 (2026-10-29)

리뷰 차원: implementation. 대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `tasks.md`.
기준 코드: `roblox/archer-command/`(읽기만) · `docs/research/2026-10-26-roblox-development/`. 표준: `roblox/AGENTS.md`, 연구 README §0. 지식베이스: `[[msa-roblox-archer-command-native-rebuild-record]]` (1989v, 2026-10-28) — 이 차원에 새로 더하는 함정은 없었다(Bat 날개 Transform·Terrain 런타임 채움은 아래 근거와 같다).

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 참조 모듈 존재 | PASS | `roblox/amp-arena/` 는 신규라 없음이 정상(spec.md:8). 참조하는 `roblox/archer-command/tools/{build,verify}.py`·`docs/research/2026-10-26-roblox-development/reference-analysis.md`·`amp-arena/docs/GDD.md` 전부 존재. 봇 자멸 36% 출처 확인(`amp-arena/docs/GDD.md:228`). 헤더 `<!-- source: … -->` 가 미래 파일을 가리키는 것은 archer 스펙과 같은 관행(`docs/specs/2026-10-28-roblox-archer-native/spec.md:1`) |
| 2 | 기존 코드와 충돌 | REVISE | R1(Terrain 을 ServerStorage 맵에 담을 수 없음) · R2(리스폰 제어가 엔진 기본값과 충돌) · R5(공유 모듈이 시계를 읽을 수 없음) |
| 3 | 복잡도 위험 | REVISE | Combat 상태 11 × 의도 6 × 스타일 5 × 액세서리 5. 전이 규칙은 `Rules` 에 두고 Combat 은 부수효과만 — 스펙 방향은 맞다(spec.md:24,27). 상태 종료 공통 정리가 없으면 11 상태 각각에 누수가 생긴다 → R4 |
| 4 | NFR 안티패턴 | REVISE | 상한은 있다(봇 ≤7·투사체 상한·아이템 30초 재생성, spec.md:67). 없는 것: LAUNCHED 타임아웃(R3), Attribute 매 틱 복제·LinearVelocity 인스턴스 생성/파괴(R6) |
| 5 | 마이그레이션/롤백 | N/A | DataStore 없음(requirements.md:36). 롤백 = git revert. `dist/*.rbxlx` 는 archer 처럼 커밋 대상(`roblox/archer-command/dist/ArcherCommand.rbxlx` 존재), `__pycache__` 는 `.gitignore:8` 이 막는다 — 스펙에 dist 커밋 여부 한 줄만 적으면 된다 |
| 6 | 동시성 | REVISE | Heartbeat 는 단일 스레드지만 `Died`·`PlayerRemoving`·`ProximityPrompt.Triggered`·`task.delay(LoadCharacter)` 가 프레임 사이에 끼어든다. HELD/GRABBING 중 사망·퇴장, 결과 단계 중 맵 Destroy 로 낙하 → R4 |

## 부모가 지목한 세 가지 — 실현 가능성 판단

### A. 서버 Heartbeat 상태 머신 + 클라이언트 소유 물리 (spec.md:40-49, requirements.md:28)
**성립한다. 단, 셋 중 둘은 조건이 붙는다.**
- **LinearVelocity 넉백**: 서버가 만든 제약은 복제되어 소유 클라이언트가 시뮬레이션한다. 시작·종료가 RTT/2 씩 늦게 도착하므로 지속 시간은 대체로 보존된다. 조건: `RelativeTo = World`(기본값 `Attachment0` 이면 캐릭터가 돌 때 방향이 따라 돈다), `MaxForce` 를 Humanoid 지면 제어보다 크게. 클라이언트가 로컬에서 무력화할 수 있는 것은 알려진 한계이고 연구 README 가 이미 「물리 치트 방어는 별도 항목」으로 뗐다(`docs/research/2026-10-26-roblox-development/README.md:64`).
- **FloorMaterial 착지** → **R3**. 서버가 읽는 플레이어 캐릭터의 `FloorMaterial` 은 소유 클라이언트에서 복제된 값이라 RTT 만큼 늦다. LAUNCHED 진입 직후 검사하면 아직 바닥이 보여 즉시 DOWN 이 된다. 봇은 서버 소유(archer `Npc.luau:50-54` 방식)라 정확하므로 **Studio 혼자 봇과 테스트하면 이 결함이 안 보인다**.
- **Weld 잡기** → **R4**. 두 플레이어 캐릭터를 Weld 하면 어셈블리가 합쳐져 네트워크 소유가 한쪽으로 몰린다(다른 쪽은 원격 시뮬레이션). 피해자 Humanoid 는 계속 서려고 하므로 `PlatformStand = true`(또는 Physics 상태) 없이는 Weld 와 싸운다. 탈출(약공 6회)은 Remote 명령이라 물리 소유와 무관하게 동작한다 — 이 점은 괜찮다. 스펙의 이동 잠금(spec.md:46 `WalkSpeed 0`)만으로는 부족하다.

### B. Motor6D.Transform 절차 포즈를 Stepped 에서 (spec.md:23,34, requirements.md:24)
**맞는 방식이다.** `Transform` 은 Animator 가 매 프레임 덮어쓰고, Stepped 는 애니메이션 적용 뒤·물리 전에 돌아 덮어쓸 수 있다. archer 가 박쥐 날개에 같은 패턴을 쓴다(`roblox/archer-command/src/client/Effects.client.luau:203-210`). 복제되지 않는 값이므로 「모든 클라이언트가 태그된 모델 전부를 포즈한다」는 구성(spec.md:34)이 옳고, 서버는 루트 위치로만 판정하니(spec.md:42) 포즈를 몰라도 된다. 조건 둘:
- **R5-a 기본 보행 통과**: `Fight` 가 idle/walk 일 때 Transform 을 쓰면 기본 `Animate` 의 걷기·점프가 죽는다. 그 상태에서는 Transform 을 건드리지 않는다고 스펙에 적어야 한다.
- **R5-b 공유 시계**: `MoveAt`·`FightAt` 으로 phase 를 계산하려면 서버와 클라이언트가 같은 시계를 써야 한다. `os.clock()` 은 기기마다 다르다(archer 는 서버 안·클라이언트 안에서만 각각 쓴다 — `Main.server.luau:250`, `Effects.client.luau:76`). `workspace:GetServerTimeNow()` 를 양쪽에서 쓴다. 공유 모듈은 `workspace` 를 읽을 수 없으므로(archer `tools/verify.py:43` 게이트, 이 스펙도 같은 게이트 spec.md:67) `Poses.sample` 은 phase 를 인자로 받는다.
- R6 Motor6D 의 C0/C1 은 어깨·엉덩이가 Y 축 90° 돌아 있다(`roblox/archer-command/tools/build.py:432-435`). 「각도 deg」는 관절별로 모터 좌표계로 변환해야 하며, 단위 테스트(test-quality.md:7)는 논리 각도만 재므로 생김새는 UNVERIFIED 가 맞다(spec.md:69 에 이미 있음).

### C. R6 강제 (requirements.md:24, OQ3)
**문제 없다.** `StarterPlayer.GameSettingsAvatar = 0` 은 파일에 담기고 Studio 에서 파일을 열어 Play 하면 그대로 적용된다. 장르 관용구(requirements.md:11 TSB·Item Asylum 이 R6)와 맞고, 6 관절이 BlockRig 와 1:1 이다(`build.py:430-435`). 조건:
- 업로드 뒤에는 Creator Hub 의 아바타 설정도 같아야 한다 — OQ5 범위라 README 의 「열어서 놀기」에 한 줄(archer README:8 의 Max Players 와 같은 자리).
- `Model:ScaleTo` 를 플레이어 캐릭터에 서버가 호출하는 것은 archer 가 `pcall` 로 감싼다(`Rigs.luau:120,150`). 같은 처리 + 히트 기하의 `bodyRadius` 는 측정값이 아니라 스타일 상수로.
- `Humanoid.BreakJointsOnDeath` 기본값 true 라 KO 시 R6 가 분해되고 손에 Weld 한 액세서리가 떨어진다. archer 는 NPC 에 false 를 준다(`Rigs.luau:74`). KO 연출(spec.md:35 폭발)을 몸이 남은 채로 하려면 false.

## REVISE 항목

**R1. Terrain 모래 바닥은 ServerStorage 맵 클론에 담을 수 없다** (Check 2)
- 스펙: 콜로세움 「모래 바닥(Terrain Sand)」(spec.md:60) · 「맵은 ServerStorage.Maps 에 두고 매치마다 Workspace 로 Clone, 끝나면 Destroy」(spec.md:63) · 빌더가 맵 2 를 만든다(spec.md:37).
- 근거: Terrain 은 Workspace 단일 객체다. archer 도 「Terrain 은 파일에 담지 않고 서버가 실행 시 채운다」(`roblox/archer-command/tools/build.py:3`, `src/server/World.server.luau:2,5`).
- 수정안(둘 중 하나): ① 바닥을 `Material = Sand` 인 Part/Cylinder 로 바꾼다(가장 단순, 결정적 빌더에 그대로 들어감) ② 맵 로드 시 `Terrain:FillCylinder`, 언로드 시 `Terrain:Clear()` 를 Main 의 맵 전환에 넣고 모듈 표에 적는다. ①을 권한다 — 라운드마다 Terrain 을 지우고 채우는 것은 득이 없다.

**R2. 리스폰 제어가 엔진 기본값과 충돌한다** (Check 2)
- 스펙: 데스매치 「3초 뒤 LoadCharacter」, 서바이벌 「관전 없이 로비 발판에서 대기」(spec.md:49). 빌더 목록에 `Players` 서비스 설정이 없다(spec.md:37).
- 근거: `Players.CharacterAutoLoads` 기본 true · `RespawnTime` 기본 5초. 그대로 두면 서바이벌 KO 자가 5초 뒤 **임의의 활성 SpawnLocation**(로비 8 + 맵 8, spec.md:59-61 전부 중립)에 되살아나 진행 중인 서바이벌에 다시 들어간다. archer 는 LoadCharacter 를 안 써서 이 문제가 없었다(`build.py:380-383` 에도 Players 항목 없음).
- 수정안: 빌더가 `Players.CharacterAutoLoads = false` 를 쓰고 Main 이 모든 스폰을 소유한다(입장 시 로비로 LoadCharacter, 매치 시작·데스매치 리스폰은 서버가 `Player.RespawnLocation` 지정 또는 LoadCharacter 뒤 `PivotTo`). verify 게이트에 `CharacterAutoLoads false` 한 줄 추가. 퇴장한 플레이어의 `task.delay(3, LoadCharacter)` 는 `player.Parent` 검사로 버린다.

**R3. LAUNCHED → 착지 판정에 선행 조건과 타임아웃이 없다** (Check 4·6)
- 스펙: 「LAUNCHED(LinearVelocity 수평·상승 0.2초) → 착지(FloorMaterial ≠ Air) → DOWN」(spec.md:43).
- 근거: 위 A 절. 서버가 보는 플레이어 `FloorMaterial` 은 복제 지연이 있어 진입 직후엔 바닥이 보인다. 또 착지가 영영 안 오는 경우(다른 캐릭터 머리 위·난간 모서리에서 Air/바닥 깜빡임·링아웃 전 낙하)가 있는데 HELD 는 2초 상한이 있고(spec.md:45) LAUNCHED 는 없다.
- 수정안: 「Air 를 한 번 관측한 뒤 ≠ Air」 또는 「진입 후 최소 0.25초 경과 + ≠ Air」 → DOWN. 상한(예: 2.5초) 초과 시 DOWN 강제. 링아웃(spec.md:48)은 그 전에 독립적으로 걸린다. 이 값들은 `Config` 에.

**R4. 상태 종료의 공통 정리 규칙이 없다 — Weld·LinearVelocity·Humanoid 속성** (Check 3·6)
- 스펙: HELD 상한·탈출(spec.md:45), 이동 잠금 속성(spec.md:46), KO → Died(spec.md:49), 맵 Destroy(spec.md:63). 어느 항목도 「상태를 어떻게 빠져나오든 무엇을 되돌리는가」를 말하지 않는다.
- 근거: 프레임 사이에 끼는 이벤트들(Check 6). 구체 사례 — HELD 중 피해자 `Died`(폭탄·투사체) → Weld 가 시체에 남고 공격자는 GRABBING 에 갇힌다 · 잡은 채 `PlayerRemoving` → 캐릭터 제거로 Weld 가 끊기지만 상대 상태는 남는다 · 결과 단계에서 맵 Destroy → 서 있던 전원 낙하 → 링아웃 KO 크레딧이 결과 뒤에 찍힌다 · 라운드 종료 시 `WalkSpeed 0` 이 남은 채 로비로.
- 수정안: Combat 에 단일 `leave(fighter)` — Weld 제거·LinearVelocity 비활성·`PlatformStand false`·WalkSpeed/JumpPower/AutoRotate 복원·상대(held/grabbing 짝) 동시 해제. `Died`·`PlayerRemoving`·`CharacterRemoving`·라운드 종료가 전부 이것을 부른다. 링아웃·KO 판정은 `phase == match` 에서만. 맵 Destroy 전에 전원 로비로 LoadCharacter(R2 와 같은 경로). HELD 는 `PlatformStand = true` + 피해자 파트 `Massless`·`CanCollide false`, 던지기 속도는 Weld 제거 **다음** Heartbeat 에 넣는다(소유권 복귀 뒤).

**R5. 포즈 시계와 기본 보행 통과를 스펙에 명시** (Check 2·3)
- 스펙: Poser 「Attribute(`Fight`·`Move`·`MoveAt`·`FightAt`) → `Poses.sample` → `Motor6D.Transform`(Stepped)」(spec.md:34), Attribute 목록(spec.md:56), 공유 모듈 무 Roblox API 게이트(spec.md:67).
- 근거: 위 B 절. 시계를 적지 않으면 구현이 `os.clock()` 을 쓰기 쉽고(archer 서버가 그렇다, `Main.server.luau:250`) 그러면 phase 가 클라이언트마다 다르다. `Poses` 가 `workspace` 를 읽으면 게이트에 걸린다.
- 수정안: spec.md:56 에 「`MoveAt`·`FightAt` 은 `workspace:GetServerTimeNow()`」, spec.md:34 에 「idle/walk/jump 는 Transform 을 쓰지 않는다(기본 Animate 유지)」와 「`Poses.sample(id, phase)` 의 phase 는 호출자가 계산」. verify 게이트에 `GetServerTimeNow` 사용 검사를 더하면 회귀 주입 대상이 하나 는다.

**R6. 복제·인스턴스 churn** (Check 4)
- 스펙: `Guard`(0~100) 를 캐릭터 Attribute 로 복제(spec.md:56) + State 4Hz 에도 「내 가드」(spec.md:55). 넉백·대시·띄움·던지기가 각각 LinearVelocity(spec.md:43,45,47).
- 근거: 가드 게이지는 초당 20 회복이라 매 Heartbeat 값이 바뀌고, Attribute 는 바뀔 때마다 전 클라이언트에 복제된다(파이터 15 × 60Hz). LinearVelocity 를 히트마다 생성·Debris 하면 Attachment 포함 인스턴스 2개가 히트마다 복제된다.
- 수정안: `Guard` Attribute 는 정수로 반올림해 값이 바뀔 때만 쓰거나, HUD 용은 State 에만 두고 Attribute 는 뺀다(다른 클라이언트가 남의 게이지를 볼 필요가 없으면 후자). 파이터마다 Attachment + LinearVelocity 하나를 리그 설정 때 만들어 두고 `Enabled`·`VectorVelocity` 만 바꾼다.

## 참고 (이슈로 세지 않음)
- 폭탄·로켓 펀치 폭발을 `Explosion` 인스턴스로 만들면 기본 `DestroyJointRadiusPercent = 1` 이 관절을 끊어 캐릭터가 분해된다. 반경 피해는 `Combat.hit` 로(투사체가 이미 그렇다, spec.md:29), 연출은 Effects `explode`(spec.md:54).
- `FallenPartsDestroyHeight` 는 Workspace 값 하나다. 콜로세움은 fallY 가 없으니(spec.md:60) 「스카이독 fallY −40 − 100」 으로 고정.
- Max Players 8 은 파일에 담기지 않는다(`roblox/archer-command/README.md:8`). README 에 Game Settings 안내.
- 모듈 표(spec.md:17-38)에 `default.project.json` 이 없다. archer 에 있고(`roblox/archer-command/default.project.json`) spec.md:16 이 Rojo 트리를 말하므로 한 줄 추가.
- 서버 히트 판정이 복제된 루트 위치를 쓰므로 RTT 만큼 과거를 판정한다. 설계 결정(requirements.md:28)이라 바꾸자는 것이 아니고, `reach`·`radius` 첫 값을 웹판보다 후하게 잡는 근거로만.

## UNVERIFIED (스펙 §4 와 같다)
Studio Play·Weld 소유권 전환 체감·LinearVelocity 넉백 거리·FloorMaterial 지연 실측·포즈 생김새·터치 버튼 배치·8인.

라운드 1 판정: REVISE (아래 Round 2 로 갱신)

---

## Round 2 (2026-10-29, 구현 뒤 재리뷰)

대상 코드: `roblox/amp-arena/src/server/{Combat,Items,Projectiles,Bots,Rigs,Commands}.luau` · `Main.server.luau` · `src/client/{Input,Poser,Effects,Hud}.client.luau` · `src/shared/{Config,Rules,Poses,Styles,Accessories}.luau` · `tools/{build,verify}.py`. 검증기 출력 `/tmp/amp_verify.txt`(PASS 37 · INFO 1 · UNVERIFIED 8). 스펙은 1차 지적대로 고쳐져 있다(spec.md:68 CharacterAutoLoads false · spec.md:103 `Combat.leave` · spec.md:123 Part Sand · spec.md:130 게이트 목록).

### 1차 이슈 해소 확인

| R | 판정 | 코드 근거 |
|---|---|---|
| R1 Terrain → Part Sand | **해소** | `tools/build.py:236-237` 바닥 `Desert`·`Floor` 가 `Material='Sand'` Cylinder Part, `build.py:26` 재질 토큰 1296. Terrain 참조 0건(grep). spec.md:123 와 일치 |
| R2 CharacterAutoLoads false + 서버 LoadCharacter | **해소** | 빌더 `build.py:470` + 런타임 `Main.server.luau:23`. 입장 `Main.server.luau:267`, 로비/아레나 분기 `100-119`(`PivotTo` + `pickSpawn`), 데스매치 리스폰은 `respawnAt` 폴링 `325-327` → `respawnHuman` `120-125`(퇴장자는 `humans[player]` 가 nil 이라 자연히 버려짐, `271-276`). 서바이벌 KO 자는 `e.alive=false` 로 LoadCharacter 되어 `106` 의 `inMatch` 가 거짓 → 로비 발판. 로비 사망 재세움 `116` 이 `player.Parent` 를 본다. 스폰은 SpawnLocation 이 아니라 Part(`build.py:187-190`)라 엔진 자동 배치와 경쟁하지 않는다 |
| R3 Air 선행 관측 + 2.5초 타임아웃 | **해소** | `Rules.luau:224-227` `launchLanded(sawAir, elapsed, onGround)`: 2.5초 초과 강제, `(sawAir or elapsed > 0.25) and onGround and elapsed > 0.1`. 호출 `Combat.luau:356-357`, `sawAir` 초기화 `164`·`185`. 작은 흠: 2.5/0.25/0.1 이 `Config` 가 아니라 `Rules` 에 박혀 있다(spec.md:50 「수치 한 곳」) — 동작엔 영향 없음 |
| R4 cleanup()/leave() | **해소** | `Combat.luau:383-389` `cleanup`(짝 해제·`stopVel`·`PlatformStand false`), `390-401` `ko` 가 먼저 부름, `425` `Died` → `ko`, `428-433` `leave`. `Main.server.luau:271-276` PlayerRemoving → `leave`, `233-241` 결과→로비 순서가 spec.md:105 와 같다(leave → 아레나 Destroy → LoadCharacter). 링아웃·KO 는 `Combat.update` 가 match 단계에서만 돌아(`Main.server.luau:323`) 결과 단계엔 찍히지 않는다. HELD 중 사망: `applyHit` `153` 이 `hurt` 뒤라 `ko`→`cleanup`→`release` 가 Weld 를 지우고 홀더를 idle 로 되돌린다 |
| R5 GetServerTimeNow + 보행 통과 | **해소** | 서버 `Combat.luau:27`·`Rigs.luau:102`, 클라이언트 `Poser.client.luau:70`. idle 은 `Poses.luau:57-58` 에 없어 `forState` 가 nil → Poser `75-80` 이 한 번 `clear` 후 Transform 을 건드리지 않는다(기본 Animate 유지). phase 는 호출자가 계산(`Poser.client.luau:60-62,66`) |
| R6 Guard 정수 변화 시만 · LinearVelocity 하나 | **해소** | `Combat.luau:89-92` `setGuardAttr`(정수 바뀔 때만), 회복 틱 `322`. 파이터당 Attachment+LinearVelocity 하나 `419-423`(`RelativeTo=World`, `MaxForce=inf`), 켜고 끄기만 `42-57`. State 4Hz 도 정수 `Main.server.luau:346` |

### 체크리스트 재판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 참조 모듈 존재 | PASS | 스펙 모듈 표(spec.md:47-74)의 19 파일 전부 존재, 검증기 「compiled 19 Luau files」(`/tmp/amp_verify.txt:2`), `dist/AmpArena.rbxlx` 커밋 대상으로 존재 |
| 2 | 기존 코드와 충돌 | PASS | R1·R2·R5 해소. `Explosion` 인스턴스 미사용(클라이언트 grep 0건), `FallenPartsDestroyHeight −220 ≤ −60−100`(`build.py:430`, 검증기 13행) |
| 3 | 복잡도 위험 | REVISE | 공통 정리는 생겼으나 `cleanup` 의 순서가 Main 훅과 엇갈린다 → N1 |
| 4 | NFR 안티패턴 | REVISE | R3·R6 해소. 남은 것: 속도 제약 만료가 match 단계 밖에서 멈춘다 → N2 |
| 5 | 마이그레이션/롤백 | N/A | 변동 없음 |
| 6 | 동시성 | REVISE | N1(훅 순서)·N2(단계 전환)·N5(`Died` 동기 발화) |

### 새 이슈 (REVISE)

**N1. KO·퇴장 때 든 폭탄이 떨어지지 않는다 — `cleanup` 이 Main 훅보다 먼저 `item` 을 지운다** (Check 3·6)
- 스펙: 「죽거나 나가면 그 자리에 떨어진다」(spec.md:87), 「들고 있던 폭탄은 떨어진다」(spec.md:103).
- 근거: `Combat.ko` 는 `cleanup(V)` 를 먼저 부르고(`Combat.luau:393`) 그 안에서 `F.item = nil`(`388`) 을 한 뒤에야 `Combat.hooks.ko`(`400`) 를 부른다. Main 의 훅은 `if V.item then Items.dropHeld(V)`(`Main.server.luau:256`) 라 항상 거짓 — 죽은 코드다. 퇴장 경로(`Main.server.luau:271-276`)는 `dropHeld` 를 아예 부르지 않는다. 결과: 폭탄이 시체 손에 Weld 된 채 남고, 캐릭터가 지워지면 `Massless`·`CanCollide false` 상태(`Items.luau:117`)로 바닥을 뚫고 떨어진다. `rec.holder` 가 남아 있어 봇 탐색(`Items.luau:173`)·낙하 청소(`216`)도 건너뛴다. 퓨즈(`114`)가 결국 터뜨리므로 누수는 아니지만 스펙 동작이 아니다.
- 수정안: `Combat.hooks.dropItem = function(F) end` 를 추가하고 `cleanup` 이 `F.item = nil` **전에** `if F.item then Combat.hooks.dropItem(F) end` 를 부른다(Main 이 `Items.dropHeld` 로 배선). Main 훅의 `256` 행은 지운다. 스펙의 「Combat 이 위로 부를 일은 전부 hooks」(spec.md:71) 와 같은 모양이다.

**N2. 결과 단계에 LinearVelocity 가 켜진 채 남는다** (Check 4·6)
- 스펙: 결과 10초 → 로비(spec.md:43), 「경타 밀림 0.12초·띄움 0.2초」(spec.md:79).
- 근거: 속도 만료는 `tickFighter` 안에서만 끈다(`Combat.luau:321`), `Combat.update` 는 match 단계에서만 돈다(`Main.server.luau:323`). `endMatch` 는 `setFrozen(true)` 만 하고(`229`) `setFrozen` 은 이동 잠금만 바꾼다(`Combat.luau:441`). 마지막 순간 맞은 파이터는 `stopVel` 이 불리는 `toLobby`(`Main.server.luau:236` → `leave` → `cleanup`)까지 `Config.MATCH.resultSeconds = 10`(`Config.luau:20`) 동안 제약이 켜져 있다. Vector 모드(띄움 `Combat.luau:165`, 던지기 `187`)면 상승 속도가 상수로 유지돼 결과 화면 내내 위로 날아간다.
- 수정안: `Combat.setFrozen(F, on)` 에서 `if on then stopVel(F) end`. 검증기 게이트 한 줄(`'stopVel(F)' in setFrozen 본문`)로 회귀 주입 대상에 넣는다.

**N3. 로비에서 장비를 다시 고르면 몸집이 1.0 으로 돌아오지 않는다** (Check 2)
- 스펙: 로비 단계에서 장비 변경 허용(spec.md:86), 스타일 몸집(spec.md:51).
- 근거: `Rigs.prepare` 가 `if style.scale ~= 1 then model:ScaleTo(style.scale)`(`Rigs.luau:93`). `ScaleTo` 는 절댓값이라 헤비(1.18, `Styles.luau:30`) → 파이터(1.0) 로 바꾸면 호출 자체가 건너뛰어 1.18 이 남는다. 로비 재선택 경로는 `Main.server.luau:285` 가 같은 캐릭터에 `prepare` 를 다시 부르는 것이다. 매치 캐릭터는 LoadCharacter 로 새로 만들어지니 매치엔 안 샌다 — 로비 미리보기만 틀린다.
- 같은 자리: `ScaleTo` 뒤에 `attachAccessory`(`94`) 가 붙어 액세서리 모델과 grip 오프셋(`Accessories.luau:13-33`)은 스케일되지 않는다. 헤비가 든 대검은 0.18 스터드 어긋난 보통 크기다(시각만).
- 수정안: `if model:GetScale() ~= style.scale then pcall(model.ScaleTo, model, style.scale) end`. 액세서리는 클론 뒤 `acc:ScaleTo(style.scale)` + C0 오프셋 × scale.

**N4. `BreakJointsOnDeath = true` 가 dead 포즈·Grip Weld 와 충돌한다** (Check 2)
- 스펙: `Fight = dead` 상태(spec.md:58), 포즈 테이블의 `dead`(`Poses.luau:67`).
- 근거: `Rigs.luau:85` 가 `hum.BreakJointsOnDeath = true`. 죽는 순간 Motor6D 가 전부 끊겨 Poser 가 `dead` 포즈를 쓸 관절이 없고(`Poser.client.luau:16-28` 캐시는 죽은 참조를 그대로 가진다), 손의 `Grip` Weld(`Rigs.luau:37-41`) 도 끊겨 액세서리가 바닥에 떨어진다. 1차 §C 가 false 를 권했고 archer NPC 도 false 다. 시체는 데스매치 3초 뒤 LoadCharacter(`Main.server.luau:124`)·봇은 `removeBot`(`140`) 이 치운다.
- 수정안: `BreakJointsOnDeath = false`. 그러면 dead 포즈가 보이고 액세서리가 손에 남는다.

**N5. `Died` 가 동기로 발화하면 마무리 타격의 KO 크레딧이 빠진다** (Check 6, 낮음)
- 스펙: 「KO 크레딧 = 3초 안 마지막 타격자」(spec.md:25,84).
- 근거: `hurt` 가 `Health` 를 먼저 쓰고(`Combat.luau:122`) `lastHitBy` 를 그다음 적는다(`123`). `Died` 핸들러(`425`)가 그 사이에 동기로 돌면 `Combat.ko(F, nil, "died")` 가 `Rules.koCredit(lastHitBy…)` 로 **직전** 타격자(또는 nil)에게 크레딧을 주고, `125` 의 정식 `ko(V, A, "hit")` 는 `392` 에서 되돌아간다. 빌더는 `Workspace.SignalBehavior` 를 쓰지 않아(`build.py` grep 0건) 엔진 기본값에 걸린다. `Died` 가 다음 스텝에 오면 문제 없다 — Studio 로만 확정된다.
- 수정안(둘 다 한 줄): `122`·`123` 순서를 바꿔 `lastHitBy`·`lastHitAt` 을 먼저 쓴다. 빌더에 `SignalBehavior = Deferred` 를 넣는다.

### 부모가 지목한 다섯 가지 — 실현 가능성

- **Motor6D.Transform 축 부호** — **유도로 맞다.** BlockRig 의 C0 가 기본 R6 와 같고(`build.py:410-415`, archer `build.py:430-435` 와 동일), 어깨 C0 = Ry(90°) 에서 관절 프레임은 X=앞·Y=위·Z=오른쪽이다. 매달린 팔(−Y)에 Rz(+θ) 를 주면 (sinθ, −cosθ, 0) 로 앞으로 들리고, 왼쪽은 Ry(−90°) 라 X=뒤가 되어 부호가 뒤집힌다 — `Poser.client.luau:36-39` 의 `rad(fwd)`/`rad(-fwd)`, `rad(-out)` 과 일치. RootJoint/Neck 프레임(X=왼쪽·Y=뒤·Z=위)에서 `CFrame.new(0, -dz, dy)`·`Angles(pitch, -roll, yaw)`(`33-34`) 도 pitch+ = 앞으로 숙임, yaw+ = 왼쪽 회전으로 `Poses.luau:4` 의 정의와 맞는다. 생김새(다운 포즈가 바닥에 닿는지)는 UNVERIFIED 그대로.
- **LinearVelocity Plane/Vector 모드 전환** — **문제 없다.** 같은 인스턴스에서 `VelocityConstraintMode` 와 축·속도를 바꾸고 `Enabled` 를 켠다(`Combat.luau:42-56`). Plane 모드는 `PrimaryTangentAxis=x`·`Secondary=z` 로 Y 를 중력에 맡기고, Vector 모드는 세 축을 다 잡아 0.2초 동안 상승을 유지한 뒤 끈다. `RelativeTo=World` 라 탄젠트 축이 월드 축이다. 속성 변경은 한 인스턴스 안에서 순서대로 복제된다.
- **Weld 로 두 플레이어 캐릭터 결합** — **구현됐고, 정적으로는 더 못 본다.** `doGrab`(`Combat.luau:108-118`) 이 Weld(Part0 홀더 root, Part1 피해자 root, `holdOffset` 2.4 앞, 180° 회전) + 피해자 `PlatformStand=true`, 홀더는 grabbing 으로 `WalkSpeed 0`·`AutoRotate false`. 1차 R4 가 권한 두 가지가 빠졌다: 피해자 파트 `Massless`·`CanCollide false` 는 없고, 던지기 속도는 Weld 제거와 **같은 호출** 안에서 넣는다(`179` → `187`). 제약이 복제되므로 어느 쪽이 시뮬하든 적용은 되지만, 소유권 복귀 중 손실·홀더 Humanoid 가 두 몸 무게를 균형 잡는 체감은 Studio 에서만 안다(검증기 UNVERIFIED 42행). 값싼 보강: 잡는 동안 피해자 BasePart 를 `Massless=true` 로 하고 `release` 에서 되돌린다.
- **ProximityPrompt 서버 재확인** — **맞다.** `Triggered` → `Items.pickupBy`(`Items.luau:136-140`) 가 `rec.holder`·`F.item`·`F.state=="idle"`·`model.Parent`·평면 거리 ≤ `pickupDistance+2`(`107-109`) 를 서버에서 다시 본다. 봇도 같은 함수(`Bots.luau:97`). 줍고 나면 프롬프트를 끄고 다시 켜지 않는데(`115`) 퓨즈가 줍는 순간 시작되어(`114`) 다시 주울 일이 없으니 맞다.
- **ScaleTo 와 Weld 오프셋** — N3 로 올렸다. 순서(`Rigs.luau:93-94`)상 오프셋·액세서리가 스케일되지 않고, 1.0 복귀가 건너뛴다. `pcall` 감쌈(`93`)은 1차 §C 대로다.

### UNVERIFIED (검증기 40-47행과 같다)
Studio Play · LoadCharacter 뒤 PivotTo 가 엔진 배치에 덮이지 않는지 · Weld 두 캐릭터 소유권 전환 · LinearVelocity 넉백 체감 · `Died` 발화 시점 · 포즈 생김새 · 터치 버튼 · 8인.

### 판정
R1~R6 전부 해소. 새 이슈 5건 — N1·N2 는 스펙 동작과 어긋나는 것(폭탄 낙하 없음·결과 단계 상승), N3~N5 는 한두 줄 보강. 사람 판단이 필요한 것은 없다.

VERDICT: REVISE
