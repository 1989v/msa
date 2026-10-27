# Spec Review — Security (Roblox client/server trust · exploit resistance · data safety)

대상: `docs/specs/2026-10-28-roblox-archer-command/spec.md` (+ `planning/requirements.md`)
참조: `roblox/infinity-step/src/server/Main.server.luau`, `Ingress.luau`, `Progress.luau`, `Ledger.luau`, 원작 `portal-fe/public/games/marine-command/js/origin/{sim,save,session,transport}.js`, `docs/research/2026-10-26-roblox-development/README.md` §3·§5
리뷰일: 2026-10-28

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 위협 모델링 | 부분 | 스펙은 「클라이언트는 좌표·피해·보유량을 정하지 않는다」(spec.md:38) 한 줄뿐. 리더 위치는 클라이언트 소유 캐릭터가 정한다(spec.md:26)는 결정이 그 원칙과 충돌하는데 다루지 않음 → F1 |
| 인증/인가 경계 | 부분 | 소유자 배정(spec.md:35)이 userId 와 결속되는지, 나갔다 들어온 사람과 새 사람을 어떻게 가르는지 없음 → F2 |
| 민감 데이터 흐름 | 통과 | PII 없음. 저장 키는 Roblox userId 뿐(spec.md:39), 요약 전송은 게임 상태만(spec.md:36). HttpService·MarketplaceService 외부 호출 없음(Out of Scope spec.md:63) |
| 입력 검증 바운더리 | 부분 | 「타입·유한수·소유권·빈도(초당 20)」(spec.md:38) 선언은 있으나 명령별 규칙이 없음 → F4, F5 |
| 서비스 간 통신 | 해당 없음 | 단일 서버·RemoteEvent 만 |
| 시크릿 관리 | 통과 | 시크릿 없음 |
| 저장 무결성 | 부분 | 「불러오기 실패는 새 원정으로 덮지 않는다」(spec.md:39) 는 좋음. 버전 불일치·로드 전 저장·UpdateAsync 검증·BindToClose 예산이 빠짐 → F3 |
| 감사 로깅 | 미정 | 거부된 명령·클램프된 이동 횟수를 서버 로그에 남기는 규칙 없음(F1·F4 수정안에 포함) |
| Rate Limiting / Abuse | 부분 | 초당 20 선언만. 버킷 모양·초과 시 동작 없음 → F4 |

## Findings (6)

### F1 · 리더 위치를 클라이언트 캐릭터에서 그대로 읽는다 — 서버 클램프 필요 (REVISE, 최우선)
- 근거: spec.md:26 「리더 위치는 Roblox 캐릭터가 정하고(서버가 HumanoidRootPart 를 읽어 틱마다 넣는다)」, spec.md:37 「Humanoid.WalkSpeed = 13.75」.
- 문제: Roblox 캐릭터 물리는 기본적으로 클라이언트가 네트워크 소유자다. 익스플로잇 클라이언트는 HumanoidRootPart 를 임의 CFrame 으로 옮기고(텔레포트), 로컬 Humanoid.WalkSpeed 를 올리고, 점프로 8스터드 절벽을 넘을 수 있다. 스펙은 그 값을 검증 없이 Sim 에 넣으므로 다음이 전부 가능해진다: 경사로 없이 고지 진입(spec.md:30 「경사로는 양쪽 셀의 ramp 플래그로만 고도를 넘는다」 무력화), 동쪽 문 너머 진입(spec.md:18), blocked 셀·분지 밖 진입, 추종자 전원을 리더 주변 슬롯으로 순간이동(spec.md:26 황금각 슬롯) = 무료 구르기, 처치 기여 10초 창 악용. 원작은 입력을 단위 벡터로 정규화하고 속도×dt 만큼만 `canTraverse` 로 움직인다(`origin/sim.js:507-508`, `497-500`).
- 수정안 (spec.md:26·37 에 추가):
  1. 서버가 소유자별 「마지막 수용 리더 위치」를 Sim 안에 둔다. 틱마다 캐릭터 위치와의 차이를 재서 `|Δ| ≤ WalkSpeed × dt × 1.5` 이고 목적 셀이 `Grid` 에서 통행 가능(blocked 아님, 고도 변화는 ramp 셀을 거친 경우만)일 때만 수용한다. 아니면 Sim 위치는 그대로 두고 캐릭터를 `PivotTo` 로 되돌린다(서버 권위 복원). 구르기(E) 중에는 Sim 이 정한 경로로만 옮긴다.
  2. `Humanoid.JumpPower=0` + `SetStateEnabled(Jumping,false)` 를 서버가 캐릭터 생성마다 설정하고(선행 프로젝트 `Main.server.luau:264-265` 와 같은 모양), WalkSpeed 는 서버가 틱마다 다시 쓴다(클라이언트 변경은 1 에서 무효화된다).
  3. 되돌림 횟수를 플레이어별로 세어 서버 로그에 남긴다(감사 항목).
  4. SR-5 `tests/run.luau` 에 「한 틱에 20스터드 점프한 리더 입력 → 위치 미변경」 케이스를 넣는다.

### F2 · coop 소유자 슬롯이 userId 에 결속되지 않고, 강제 coop 전환이 공개 서버에서 누구나 가능하다 (REVISE)
- 근거: spec.md:35 「플레이어 입장 → 소유자 배정(최대 2) … 두 번째 입장 시 캠페인이 coop 으로 전환」, requirements.md:47 「한 명이 나가도 coop 으로 남는다」, spec.md:39 「소유자 키 `ArcherCommand_v1/<userId>` 에 캠페인 스냅샷」, spec.md:12 「친구가 같은 서버에 들어오면」.
- 문제 (셋):
  1. **슬롯 탈취**: A(슬롯 0)·B(슬롯 1) 가 있다가 A 가 나가고 C 가 들어오면 「최대 2」규칙만으로는 C 가 슬롯 0 = A 의 지갑·병력·강화를 받는다. 원작은 명령의 ownerId 가 좌석에 묶인 값과 다르면 거부한다(`origin/transport.js:151`).
  2. **스냅샷 분기**: coop 상태(두 소유자 포함)가 A 키와 B 키에 각각 저장되면 같은 캠페인의 사본 둘이 독립 진화한다. 원작은 `coopDerived`·`forkId`·`campaignId` 로 구분한다(`origin/session.js:239-241`, `origin/save.js:230`). 협동 복구 UI 는 Out of Scope(spec.md:63)라도 **무엇이 저장되는지**는 정해야 한다.
  3. **강제 coop**: Roblox 서버는 기본 공개다. 모르는 사람이 들어왔다 나가기만 해도 솔로 캠페인이 영구히 coop(적 HP ×1.5·웨이브 ×1.4)이 되어 그 상태로 저장된다. 원작은 호스트가 세션을 열어야 coop 이 된다.
- 수정안 (spec.md:35·39 에 추가):
  1. `owners[i].userId` 를 Sim 상태에 둔다. 입장 시 같은 userId 의 슬롯이 있으면 그것을 돌려주고, 없으면 빈 슬롯만 준다. 빈 슬롯이 없으면(둘 다 다른 userId) 입장을 거부하거나 관전으로 두고 명령을 전부 거부한다.
  2. 스냅샷은 **자기 userId 가 소유자인 캠페인만** 자기 키에 쓴다. coop 상태를 저장할 때는 상대 슬롯을 통째로 넣되 `campaignId`(GUID) 를 함께 둔다. 이어하기 때 상대 슬롯은 그 userId 가 들어와야만 움직인다. 「최소 결속」만 정하고 분기 병합은 다음 단계로 명시한다.
  3. place 의 MaxPlayers 를 2 로 두고, coop 전환은 **첫 소유자가 수락**(RemoteEvent `acceptCoop`)해야 일어난다고 쓴다. 수락 전 두 번째 플레이어는 관전·명령 거부 상태다. 이것이 과하면 최소한 「공개 서버에서 누구나 coop 으로 바꿀 수 있다」를 알려진 가정으로 적는다.

### F3 · DataStore 스냅샷 무결성 — 버전 불일치·로드 전 저장·검증 갱신·BindToClose 예산 (REVISE)
- 근거: spec.md:39 「60초마다·퇴장·BindToClose. 불러오기 실패는 새 원정으로 덮지 않고 오류를 보여 준다」, spec.md:35 「스냅샷이 있으면 이어하기 / 새 원정 선택」.
- 문제:
  1. 「실패」와 「맵 버전 불일치」가 구분되지 않는다. 원작은 버전 불일치 기록을 보존하고 새 원정만 허용한다(`origin/save.js:210`, `origin/main.js:41`). 스펙대로면 새 원정이 옛 기록을 덮는다.
  2. 로드가 끝나기 전(선택 대기·오류 상태)에 60초 타이머·퇴장·BindToClose 가 돌면 빈 상태를 저장한다. 선행 프로젝트는 `progressLoaded` 플래그로 막는다(`Main.server.luau:288`).
  3. 쓰기 방식이 없다. `SetAsync` 로 통째로 덮으면 다른 서버(같은 userId 가 다른 서버에 접속한 경우)의 갱신을 지운다. 선행 프로젝트는 `UpdateAsync` 안에서 old 를 검증하고 기본값으로 바꾸지 않는다(`Ledger.luau:5-14`, `Progress.luau:21-26`). `docs/research/2026-10-26-roblox-development/README.md:54` 도 같은 원칙이다.
  4. BindToClose 는 30초 예산이고 같은 키의 쓰기는 6초 쿨다운이 있다. 퇴장 저장 직후 BindToClose 저장이 겹치면 두 번째가 큐에 걸린다.
- 수정안 (spec.md:39):
  - 스냅샷에 `version`·`mapVersion`·`campaignId`·`savedAt` 을 두고, 로드 결과를 「없음 / 정상 / 버전 불일치 / 읽기 실패」 넷으로 가른다. 불일치·실패는 **기록 보존 + 새 원정은 확인 뒤에만 덮어쓰기**(원작 `overwrite` 인자, `origin/main.js:30`).
  - 저장은 「정상 로드 또는 새 원정 확정」 뒤에만. 그 전엔 타이머·퇴장·BindToClose 전부 no-op.
  - `UpdateAsync` 로 쓰고, 콜백 안에서 old 의 `campaignId`·`savedAt` 이 내 것보다 새로우면 `nil` 을 돌려 쓰기를 포기한다.
  - 퇴장 저장과 BindToClose 저장은 플레이어별 「저장 중」 플래그로 합친다(`Main.server.luau:293-300` 의 progressPending 패턴). 직렬화는 `HttpService:JSONEncode` 가 아니라 Sim 의 자체 직렬화(SR-5 「저장 왕복」)를 쓰고, Roblox Instance·순환 참조가 섞이지 않게 Sim 상태만 넣는다.

### F4 · RemoteEvent 검증을 명령별 규칙으로 항목화해야 한다 (REVISE)
- 근거: spec.md:38 「명령 RemoteEvent 는 타입·유한수·소유권·빈도(초당 20)를 검증한다」, spec.md:25 명령 목록.
- 문제: 선언만 있고 구현이 따를 표가 없다. 소유권의 원천(페이로드의 ownerId 인지 서버 세션인지), 빈도 초과 시 동작, 로드 전 명령 처리, 문자열·테이블 크기 상한이 전부 비어 있다.
- 수정안 (spec.md:38 아래 표로):
  - `ownerId` 는 **페이로드에서 받지 않는다**. 서버가 `sessions[player].ownerId` 를 붙인다(원작 `origin/transport.js:151-153` 과 같다).
  - 명령 이름은 허용 목록 문자열 비교. 페이로드는 명령별 고정 스키마: `hire.kind ∈ {archer,longbow,carpenter}`, `upgrade.stat ∈ {attack,armor}` · `count ∈ {1,10}`, `combine.ids` 길이 3 정수 배열, `garrison.ids` 길이 ≤ 24 정수 배열 + `towerId` 정수, `assign.job ∈ {wood,mine,repair,idle}` + `unitId` 정수, `build.x/z` 유한수, `heroSkill.skill ∈ {multishot,roll}` + `x/z` 유한수. 그 밖의 키는 무시, 타입이 다르면 조용히 버린다(오류 응답으로 프로브 정보를 주지 않는다).
  - 빈도: 선행 `Ingress.luau` 토큰 버킷(버스트 20·초당 15 보충)을 그대로 쓰고 초과는 드롭. 명령은 Sim 에 넣기 전 플레이어별 큐 길이 상한(예: 8)을 둔다.
  - 소유자 슬롯이 없거나 로드 미완(F3)·관전(F2)이면 모든 명령 거부. `sync` 류 조회 명령만 허용.
  - 거부 사유 코드·횟수를 플레이어별로 집계해 서버 로그에 남긴다.

### F5 · 스킬 조준·탑 건설 입력은 서버가 다시 계산한다고 써야 한다 + 동쪽 문 셀은 Grid 에서 blocked 여야 한다 (REVISE)
- 근거: spec.md:45 「방향은 마우스/터치 지점 → 지면 레이캐스트 … 격자 4 스터드 스냅, 확인/취소」, spec.md:25 `heroSkill(multishot|roll, 방향)`·`build(x,z)`, spec.md:18 「동쪽 원정로를 막는 문」, spec.md:51 「격자 RECTS 와 빌더 파트 일치」.
- 문제: 클라이언트가 보낸 지점·스냅 좌표를 그대로 쓰면 구르기 거리·건설 위치를 클라이언트가 정하게 된다. 원작은 다중사격은 각도만 쓰고(`origin/sim.js:333`), 구르기는 서버가 4px 단위로 `canTraverse` 를 밟아 끝점을 정하며 길이는 `min(120, n)`(`origin/sim.js:339-341`), 건설은 `canBuild` + 점유 footprint 로 거른다(`origin/sim.js:399-406`). 또 문이 파트로만 있고 Grid 셀이 통행 가능하면 F1 의 클램프도, 건설 명령도 문 너머를 막지 못한다. spec.md:51 검사는 「blocked 셀 위에 파트가 있다」만 보고 「문 셀이 blocked 다」는 보지 않는다.
- 수정안:
  - spec.md:25 에 「heroSkill 의 좌표는 방향 계산에만 쓰고, 구르기 끝점·사격 대상은 Sim 이 격자로 다시 정한다. build 의 x,z 는 서버가 셀로 내림해 `canBuild` 를 통과해야 수락한다. 클라이언트 스냅·유령 파트는 표시용이다」를 명시.
  - spec.md:18·21 에 「문·분지 밖 셀은 Grid 에서 blocked」를 적고, spec.md:51 검사에 「동쪽 원정로 출구 셀이 blocked 다」 단정을 추가.

### F6 · 체력·사망 판정의 원천은 Sim 이고 Humanoid.Health 는 표시값이라고 못 박아야 한다 (REVISE)
- 근거: spec.md:37 「MaxHealth = 리더 HP, Health 는 Sim 이 정한다 … 리더 사망 시 … 금화 ≥700 이면 700G 를 차감해 새 활잡이로 본진 리스폰」.
- 문제: 자기 캐릭터의 `Humanoid.Health` 변경은 클라이언트에서 서버로 복제된다. 서버가 `Humanoid.Died` 나 `Health<=0` 으로 사망을 판정하면(선행 프로젝트는 `Main.server.luau:267-270`·`322` 에서 그렇게 한다) 클라이언트가 Health 를 계속 Max 로 써서 불사가 되거나, 반대로 상대를 … 아니라 자기 자신만 죽일 수 있다. 전자가 문제다. 또 700G 차감 리스폰이 Humanoid 이벤트에 걸리면 이벤트 중복 발화로 두 번 차감될 수 있다.
- 수정안: spec.md:37 에 「리더 HP·사망·리스폰은 Sim 의 유닛 HP 만 본다. 서버가 틱마다 `Humanoid.Health` 를 Sim 값으로 덮어쓰고 `Humanoid.Died`·`Health` 변화는 입력으로 쓰지 않는다. `BreakJointsOnDeath=false`, Dead 상태 비활성. 700G 리스폰은 Sim 안의 상태 전이(`leaderDead → respawned`)로 한 번만 일어난다」를 추가. SR-5 에 「같은 틱에 사망 이벤트 두 번 → 차감 한 번」 케이스.

## 확인했으나 이슈 없음
- PII·외부 호출: 소셜·이메일·HttpService 없음. 저장 키의 userId 는 Roblox 가 제공하는 식별자이고 외부로 나가지 않는다.
- 공유 모듈 노출: `src/shared/Sim.luau` 는 ReplicatedStorage 에 복제되어 클라이언트가 규칙을 읽을 수 있지만 서버 권위(spec.md:23)라 읽기만으로는 이득이 없다. 시드(spec.md:32)가 공유 모듈 상수로 들어가면 웨이브 구성을 미리 알 수 있으니 시드는 서버 전용 값으로 둔다(한 줄 추가 권고).
- 결제·랭킹 없음(spec.md:63) — 선행 프로젝트의 영수증·원장 경로는 이 스펙에 해당 없음.

VERDICT: REVISE

## 2차

대상: 개정 1 `spec.md` (§R 표 spec.md:15-35, SR-2 spec.md:45-49, SR-3 spec.md:51-54, SR-5 spec.md:61-66). 코드 대조: `roblox/archer-command/src/shared/Sim.luau` `applyLeader`·`heroSkill`·`build`, `Grid.luau` `adjacent`·`straightClear`·`canBuild`. 리뷰일: 2026-10-28.

### 항목별 상태

| # | 상태 | 근거 |
|---|---|---|
| F1 리더 클램프 | **해소** | spec.md:19 「서버가 틱마다 검사: … `속도×dt×2+0.5` 안이고 통행 셀이며 직선 통행이면 수용, 아니면 Sim 위치로 PivotTo(되돌림 횟수 로그) … Jump 비활성·WalkSpeed 는 서버가 틱마다 다시 쓴다」. SR-5 spec.md:62 「리더 클램프(한 틱 20 스터드 점프 → 미변경)」. 코드: `Sim.luau:700-710` 이 `speed*FIXED_DT*2+0.5`·`Grid.isWalkable`·`Grid.straightClear` 세 조건을 모두 통과해야 좌표를 받고, 아니면 `owner.correction` 을 세우고 `correct` 사건을 낸다. 고도는 `Grid.luau:155-156` 이 ramp 셀 쌍일 때만 1단 변화를 허용하므로 「경사로 없이 고지 진입」이 막힌다. 구르기 중(`Sim.luau:697`)은 클라이언트 위치를 무시한다 — spec.md:22 와 일치. 1차 수정안 1.5배 대신 2배+0.5 로 완화됐으나 한 틱(1/30초)에 1.4 스터드 미만이라 텔레포트 방어에는 충분하다 |
| F2 슬롯 결속·coop 수락 | **해소** | spec.md:23 「소유자 슬롯은 userId 에 결속 … 두 번째 사람은 호스트가 수락해야 소유자가 되고 … 수락 전·세 번째 사람은 관전(명령 전부 거부)」, `MaxPlayers=2`. 스냅샷 분기는 spec.md:24 「캠페인 키는 호스트 userId 하나 … 손님은 저장하지 않는다(명시)」 + `campaignId` 로 닫혔다. 단, Sim 의 `owners` 는 아직 `userId` 필드가 없다(`Sim.addOwner(s, ownerId, name)` `Sim.luau:81`, src 전체에 `userId` 0건) — 서버 코드가 없으니 코드 위반은 아니고, SR-3 구현 때 세션→슬롯 결속이 Sim 밖(서버 `sessions`)에 놓일 수 있음을 적어 둔다. 그 경우 스냅샷에 상대 슬롯의 userId 가 들어가야 이어하기 때 결속이 복원된다 — 아래 잔여 1 |
| F3 DataStore 무결성 | **해소** | spec.md:24 가 1차 수정안을 거의 문자 그대로 담았다: `version`·`mapVersion`·`campaignId`·`savedTick`·`savedAt`, 로드 결과 넷, 「불일치·실패는 기록 보존, 새 원정은 확인 뒤에만 덮어쓴다」, 「저장은 정상 로드 또는 새 원정 확정 뒤에만(그 전엔 타이머·퇴장·BindToClose 전부 no-op)」, `UpdateAsync` + 기존 `savedTick` 이 더 크면 포기, 「저장 중」 플래그 합침, Sim 자체 직렬화, 함수 주입 저장소. Studio 메모리 저장소 + HUD 「TEST」 표시는 1차에 없던 추가 방어(테스트 중 실 DataStore 오염 방지) |
| F4 명령별 검증 | **해소** | spec.md:52 「`ownerId` 는 페이로드에서 받지 않고 세션에서 붙인다. 명령별 고정 스키마(…) 타입이 다르면 조용히 버린다. 토큰 버킷 버스트 20·초당 15, 플레이어별 큐 ≤ 8. 로드 미완·관전이면 전부 거부. 거부 코드 횟수를 로그에 남긴다」. 1차 표의 항목이 전부 들어갔고 `garrison.unitIds ≤24 + towerId`·`assign … (+nodeId|towerId)`·`heroSkill … dx,dz,length` 로 Sim 실제 인자명에 맞춰 정밀해졌다. Sim 쪽도 `Sim.act` 가 `ownerOf(s, command.ownerId)` 로 소유자를 다시 확인하고(`Sim.luau:524-525`), `unitIdsOf` 가 중복·타인 유닛·상한 초과를 nil 로 거른다(`Sim.luau:508-519`) — 이중 방어 |
| F5 서버 재계산·문 셀 blocked | **해소(스펙) / 코드 한 줄 어긋남** | 스펙: spec.md:49 「heroSkill 좌표는 방향에만 쓰고 구르기 끝점·사격 대상은 Sim 이 격자로 정한다. build 의 x,z 는 서버가 셀로 내림해 `canBuild` 를 통과해야 수락한다」, spec.md:42 「동쪽 원정로 문(… 셀은 blocked)」, spec.md:64 「동쪽 원정로 출구 셀은 blocked」 단정. 코드: `heroSkill` 은 `dx,dz` 를 정규화해 각도로만 쓰고(`Sim.luau:460-462`), 구르기는 `length` 를 `rollMax` 로 클램프한 뒤 0.5 스터드씩 `Grid.canTraverse` 를 밟아 끝점을 정한다(`Sim.luau:490-499`) — 스펙과 일치. **어긋남**: `build` 는 `command.x, command.z` 를 셀로 내리지 않고 footprint 원점으로 그대로 쓴다(`Sim.luau:627`). `Grid.canBuild` 가 footprint 가 닿는 모든 셀을 검사하므로(`Grid.luau:302-313`) 보안상 우회는 없지만, 스펙 문장 「셀로 내림」과 다르고 소수 좌표가 결정성 해시에 그대로 들어간다. 스펙을 코드에 맞추거나(「canBuild 가 닿는 셀 전부를 검사한다」) 코드에 `// Grid.CELL * Grid.CELL` 한 줄을 넣어야 한다 — 비차단, 구현 단계 처리 |
| F6 Sim 이 HP 원천 | **해소** | spec.md:20 「리더 HP·사망은 Sim 유닛 HP 뿐. 서버가 `Humanoid.Health` 를 덮어쓰고 `Died`·`Health` 변화는 입력으로 쓰지 않는다(`BreakJointsOnDeath=false`, Dead 상태 비활성)」, spec.md:53 「틱 뒤 … Humanoid.Health/WalkSpeed 덮어쓰기」. 1차 수정안의 「700G 리스폰은 Sim 상태 전이로 한 번만」과 SR-5 「사망 이벤트 두 번 → 차감 한 번」 케이스는 문장으로 없으나, Humanoid 이벤트를 입력으로 쓰지 않는다고 못 박았으므로 중복 발화 경로 자체가 사라졌다. 리스폰이 `Sim.tick` 안 `ensureLeader`(`Sim.luau:732`)에서 일어나면 자연히 한 번이다 |

### 잔여 (비차단, 구현 단계에 넘김)
1. **스냅샷 안의 손님 userId**: spec.md:23 「같은 userId 재입장 = 같은 슬롯」과 spec.md:24 「캠페인 키는 호스트 userId 하나」를 합치면, 서버가 재시작된 뒤 이어하기에서 둘째 슬롯이 누구 것인지 알려면 스냅샷(또는 Sim `owners[i]`)에 둘째 소유자의 userId 가 있어야 한다. 1차 F2 수정안 2 의 「이어하기 때 상대 슬롯은 그 userId 가 들어와야만 움직인다」가 개정본에 문장으로 없다. 없으면 이어하기 뒤 처음 들어온 아무나(호스트 수락 뒤) 그 슬롯의 지갑·병력을 받는다. 한 줄 추가 권고: 「스냅샷의 소유자 슬롯은 userId 를 포함하고, 이어하기 뒤 둘째 슬롯은 같은 userId 만 차지한다. 다른 사람은 호스트 수락 뒤에도 빈 슬롯이 없으면 관전이다」.
2. **build 좌표 내림**(F5 표 참조) — 스펙 문장과 `Sim.luau:627` 중 하나를 맞춘다.
3. **시드 노출**(1차 「이슈 없음」의 권고): 개정본에도 「시드는 서버 전용」 문장이 없다. spec.md:34 가 shared 모듈을 Sim·Grid·Balance·Theme 넷으로 못 박았으니 Balance 에 시드 상수가 들어가지 않는 한 문제는 없다 — 구현 때 `Sim.create(seed)` 의 seed 를 서버 쪽에서 만든다는 점만 지키면 된다.

6건 모두 개정본에 해소 문장이 있고, 코드(`applyLeader`·`heroSkill`)는 스펙과 일치한다. 잔여 3건은 보안 우회 경로가 아니라 문장 보강·한 줄 코드 정합이라 구현 단계에서 닫을 수 있다.

VERDICT: SHIP
