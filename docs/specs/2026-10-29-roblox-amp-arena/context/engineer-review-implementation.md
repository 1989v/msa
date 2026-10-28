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

VERDICT: REVISE
