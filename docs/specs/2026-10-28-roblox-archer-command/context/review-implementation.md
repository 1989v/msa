# Implementation Review — 궁수 키우기 로블록스판 · 시작 분지

검토 대상: `spec.md` (2026-10-28), `planning/requirements.md`, `planning/test-quality.md`
근거 코드: `roblox/infinity-step/` (빌더·검증기·서버·카메라), `portal-fe/public/games/marine-command/js/origin/{sim,world,map,wave-ai,campaign}.js`
차원: 구현 가능성만. 아키텍처·도메인 판단은 하지 않는다.

## 체크리스트

| 항목 | 판정 | 근거 |
|---|---|---|
| 참조 모듈·패턴 존재 | OK | XML 빌더 `build_place.py:18-108`, Theme 정규식 읽기 `build_place.py:15`, Scriptable 카메라 `Orbit.client.luau:45`, `UpdateAsync` 래핑 `Main.server.luau:26-38`, RemoteEvent 빈도 제한 `Main.server.luau:177-183`, 공식 luau 실행 검증 `verify.py:12-24` |
| 기존 코드와 충돌 | OK | 새 폴더 `roblox/archer-command/`, 원작 소스 무수정 |
| 복잡도 위험 | REVISE | F1 복제 비용, F2 A* 예산·격자 크기 |
| NFR 안티패턴 | REVISE | F1 상태 요약 페이로드 상한 없음, F3 카메라 요구가 수치상 불가 |
| 마이그레이션·롤백 | OK | 저장 키에 맵 버전 포함(SR-3), infinity-step `courseVersion` 과 같은 패턴 |
| 동시성 | OK (조건) | 2인 coop 는 단일 서버 틱 안에서 처리, DataStore 는 소유자별 키. F5 의 Studio 분기만 보완 |

스케일 환산은 성립한다. 1 스터드 = 8px 로 활잡이 13.75·좀비 15.4·목수 10 스터드/s, 활잡이 사거리 23.75·장궁수 70 스터드, 셀 4 스터드, 경사로 20 스터드 길이에 8 스터드 상승(21.8°, Humanoid 기본 `MaxSlopeAngle` 89° 이내). 추종자 반경 5.25 스터드에 전투 24명이 들어가므로 경량 모델은 폭 1~2 스터드로 잡아야 한다.

## Findings

### F1. 서버가 틱마다 ~150 액터의 CFrame 을 쓰는 설계는 복제 비용 상한이 없다 — `spec.md:36`
SR-3 는 「틱마다 Sim.step → 액터 모델 CFrame 갱신(적·동료·목수·탑·투사체)」을 30Hz 로 둔다. 앵커드 파트의 CFrame 변경은 변경된 파트마다 속성 복제가 나간다. 웨이브 150 + 주변 30 + 병력 24 + 목수 8 을 파트 2개짜리 모델로 잡아도 틱당 400개 이상, 30Hz 면 초당 1만 건이 넘는 속성 복제가 클라이언트마다 간다. infinity-step 은 움직이는 파트가 Mover 몇 개뿐이라 (`World.luau:25-36`) 이 비용을 겪지 않았다.
같은 절의 10Hz 상태 요약도 「선택 가능한 적 정보」의 크기 상한이 없다. `UnreliableRemoteEvent` 는 900바이트 상한이고 일반 RemoteEvent 는 상한 없이 핑으로 돌아온다.
**수정안**: 위치 복제 경로를 하나로 정한다. ① 서버는 액터 파트를 만들지 않고 10Hz 로 `{id, kind, x, z, elev, hp비율}` 압축 배열만 보내며 클라이언트가 모델을 만들고 보간한다(`workspace:BulkMoveTo`), 또는 ② 서버가 CFrame 을 쓰되 10Hz 로 낮추고 클라이언트 보간은 없이 간다. ①을 권한다. 상태 요약은 「사거리 안 적 최대 N(예: 12)」로 상한을 적는다.

### F2. A* 예산 「256/틱」은 원작과 다르게 읽히고, 격자 크기가 명시되지 않았다 — `spec.md:30`
원작은 틱당 전역 예산 2048 (`sim.js:208`, `sim.js:585`) 에서 호출마다 `min(256, 남은 예산)` 을 쓰고 (`sim.js:260`), 웨이브 표적 탐색은 별도 512 예산에 호출당 96 (`wave-ai.js:28-29`), 미완 탐색 보존은 4개까지다 (`sim.js:252-258`). 스펙의 「예산 256/틱」을 전역 256 으로 구현하면 원작의 1/8 이라 동료 24 + 목수 8 의 경로가 틱마다 2~3명만 진행된다.
또 `findPath` 는 탐색마다 `terrain.count` 크기의 밀집 배열 4개를 만든다 (`world.js:112-114`). 원작 전체 격자(384×384 = 147k 셀)를 그대로 옮기면 Luau 에서 탐색 하나에 60만 원소 테이블을 할당한다. SR-1 좌표계는 분지 로컬(`spec.md:17`)이므로 격자는 분지만(1728/32 × 1664/32 = 54×52 = 2,808 셀)이어야 하고, 그러면 문제없다.
**수정안**: SR-2 이동 항목에 「틱당 전역 2048 · 호출당 256 · 웨이브 512/96 · 미완 탐색 4개 보존」과 「격자 = 분지 54×52, 로컬 좌표」를 적는다. 결정성 항목에는 LCG 가 `Math.imul` 32비트 곱 (`campaign.js:39`) 이라 Luau 배정도로는 1664525×2³² 가 2⁵³ 을 넘으므로 16비트 분할 곱으로 쓰고, 상태 해시는 키를 정렬해 직렬화한다는 것을 적는다(테이블 순회 순서는 계약이 아니다).

### F3. 「분지 경계 밖이 보이지 않게 고정」은 지정한 카메라 수치로 성립하지 않는다 — `spec.md:42`
피치 62°, 거리 120 스터드면 카메라는 플레이어 위 106, 뒤 56 스터드에 있다. 기본 FOV 70° 의 위쪽 모서리 광선은 수평 아래 27° 라 카메라에서 208 스터드 앞 지면에 닿는다. 즉 플레이어 앞 152 스터드까지 보인다. 분지는 216×208 스터드이므로 플레이어가 어디에 서도 한쪽 경계 밖이 화면에 든다. 그 지면까지 카메라 거리는 약 233 스터드라 FogEnd 260 도 가리지 못한다. 포커스를 안쪽으로 클램프하면 허용 영역이 수십 스터드로 줄어 「머리 위 고정」과 충돌한다.
**수정안**: 클램프 요구를 지우고, 경계 밖을 보여도 되게 만든다. 테두리 절벽을 두께 4 가 아니라 높이 24 이상의 벽으로 세우고 그 바깥에 어두운 바닥 파트 한 장을 깔거나, FogEnd 를 180 으로 내려 플레이어 60 스터드 뒤부터 잠기게 한다. 둘 중 하나를 수치로 고른다.

### F4. Humanoid 체력을 Sim 이 정하려면 기본 캐릭터 동작 셋을 꺼야 한다 — `spec.md:37`
① 기본 캐릭터에는 1%/초 회복하는 `Health` 스크립트가 들어 있어 서버가 틱마다 쓰는 `Health` 와 싸운다. ② 기본 점프(JumpHeight 7.2)로 4 스터드 바위·문·경사로 옆을 넘어 격자 밖으로 나갈 수 있다. infinity-step 은 `Main.server.luau:264-265` 에서 점프 상태를 껐다. ③ Health 0 이면 Roblox 가 `Players.RespawnTime` 뒤 SpawnLocation 에 자동 리스폰하므로 「그 자리에 리스폰」은 `Players.CharacterAutoLoads=false` + 서버 `LoadCharacter` + `PivotTo` 가 있어야 한다. ④ 「낙하·충돌 피해를 끈다」는 할 일이 없다 — Roblox 기본 캐릭터에 낙하 피해가 없다.
**수정안**: SR-3 플레이어 캐릭터 항목에 「`Health` 스크립트 제거, Jumping 상태 비활성, `CharacterAutoLoads=false` 로 서버가 리스폰 위치를 정한다」를 적고 ④ 문구는 지운다.

### F5. Studio 에서 DataStore 는 기본 차단이라 「이어하기 / 새 원정」이 뜨지 않는다 — `spec.md:35`, `spec.md:39`
Studio 는 API 접근을 켜지 않으면 `GetDataStore` 호출이 실패한다. 스펙대로 「불러오기 실패는 새 원정으로 덮지 않고 오류를 보여 준다」면 Studio Play 는 항상 오류 화면에서 멈춘다. infinity-step 은 `Main.server.luau:23-28` 에서 `RunService:IsStudio()` 일 때 메모리 저장소로 갈아 끼운다.
**수정안**: SR-3 저장 항목에 「Studio 에서는 메모리 저장소(서버 수명)로 대체하고 HUD 에 TEST 표시」를 적는다. 크기는 문제없다 — 150 적 + 32 병력 스냅샷은 수십 KB 로 키당 4MB 상한 안이고, 60초 자동 저장 × 소유자 2 는 분당 쓰기 예산(60 + 10×인원) 안이다.

### F6. RECTS 정규식 읽기와 XML 격자 대조는 가능하지만 형식 제약과 경사로 예외를 적어야 한다 — `spec.md:21`, `spec.md:51`
선례는 `build_place.py:15` 가 `Theme.luau` 를 정규식으로 읽는 것이다. RECTS 도 같은 방식이 되려면 `{x=480,y=11488,w=160,h=64,e=1,b=0,r=17}` 처럼 숫자 리터럴만 있는 평탄한 목록이어야 하고, 식·주석·변수 참조가 들어가는 순간 빌더와 런타임이 다른 격자를 본다. 검증기는 빌더의 파서를 import 해서 쓰고 두 번째 정규식을 두지 않는다(`verify.py:7` 이 `build_place` 를 import 하는 것과 같다).
XML 대조는 `Part` 의 `CFrame`+`size` 로 AABB 를 만들면 된다(`build_place.py:34-41` 이 쓰는 형식). 다만 경사로 셀은 WedgePart 라 셀 중심 높이가 0~8 사이 어디든 되므로 `test-quality.md:16` 의 「blocked 셀 위 Y≥4 파트」·「통행 셀 위 절벽 없음」 규칙에서 ramp 셀은 「WedgePart 가 셀을 덮는다」로 따로 판정한다. 경사로 기하는 원작 `map.js:88-89` 대로 고지 쪽 64px(8 스터드)·저지 쪽 96px(12 스터드)인데, 쐐기를 20 스터드 전체에 걸칠지 12 스터드에만 걸칠지(33.7°, 여전히 걸을 수 있다)를 빌더에 적는다.

## 확인되어 문제없는 것
- `ContextActionService` 키+터치 버튼, 지면 레이캐스트 조준: 표준 API. 레이캐스트 선례 `Main.server.luau:135-141`.
- `UpdateAsync` 콜백 안에서 yield 금지는 스냅샷 직렬화를 콜백 밖에서 하면 된다(`docs/research/2026-10-26-roblox-development/README.md:54`).
- 30Hz 고정 틱: Heartbeat(~60Hz) 에 누산기를 두고 틱당 최대 스텝 수(예: 4)를 정해 두면 된다. 원작도 `FIXED_DT = 1/30` 누산 방식이다(`sim.js:51`, `sim.js:77`).
- 검증 분류(Studio·물리·터치·2인·DataStore 미검증 명시)는 `verify.py:58-61` 과 같은 방식으로 가능하다.

## 판정
BLOCK 사유 없음 — 스펙 결정이 코드·문서를 위반하는 곳은 없고, 여섯 건 모두 수치·경로를 적어 넣으면 풀린다.

VERDICT: REVISE

## 2차

검토 대상: `spec.md` 개정 1 (§R, SR-1~5), `roblox/archer-command/src/shared/{Grid,Balance,Campaign,Sim}.luau`.
스펙 결정은 모두 구현 가능하고 1차 여섯 건은 해소됐다. 남은 것은 초기 구현의 코드 버그와 스펙 문장 셋이다.

### 1차 finding 상태

| # | 상태 | 근거 |
|---|---|---|
| F1 복제 비용 | 해소 | `spec.md:18` 클라이언트 렌더 + 10Hz `buffer` ≤4KB · 액터 240 |
| F2 A* 예산·격자·LCG | 스펙 해소 · 코드 일부 미달 | `spec.md:32-33`. 코드: 전역 2048 리셋 `Sim.luau:1017`, 호출 `min(256,…)` `Sim.luau:207`, 웨이브 512/96 `Sim.luau:1033,786-787`, 격자 54×52 `Grid.luau:7-12`, LCG 곱 1664525×2³² < 2⁵³ `Campaign.luau:14` 정확. 잡음 함수와 탐색 재개는 B1·B3 |
| F3 카메라 클램프 | 해소 | `spec.md:31` 클램프 없음 · 벽 24 · FogEnd 180 |
| F4 Humanoid | 해소 | `spec.md:19-20` Jump 비활성 · Health 스크립트 제거 · `CharacterAutoLoads=false` · `BreakJointsOnDeath=false` |
| F5 Studio DataStore | 해소 | `spec.md:24` `Save.new(update)` 주입 + 메모리 저장소 + HUD TEST |
| F6 RECTS·경사로 | 해소 | `spec.md:41-42` 숫자 리터럴·쐐기 20 스터드. `Grid.luau:22-29` 숫자만, `Grid.heightAt` 가 ramp id 17 의 z 108~128 = 20 스터드로 계산(`Grid.luau:143-147`) |

### 코드 버그

**B1. 잡음 함수의 32비트 곱이 배정도를 넘친다 — `Campaign.luau:20-22`, `Sim.luau:839`**
`imul(a,b) = (a*b) % 2^32` 인데 `noise` 의 둘째·셋째 호출(`Campaign.luau:25-26`)은 피승수가 32비트 값(≤2³²)이고 승수 `0x85ebca6b`·`0xc2b2ae35` 가 2³¹ 급이라 곱이 2⁶³ 까지 간다. 2⁵³ 을 넘으면 하위 비트가 날아가 `% 2^32` 결과가 원작 `campaign.js:76` 과 다르다(첫 호출만 index≲2¹³ 라 정확). `Sim.luau:839` 의 행렬 흔들림 시드도 같은 모양(2³²×0x45d9f3b ≈ 2⁵⁸). §R 「16비트 분할」결정(`spec.md:33`)을 코드가 안 지킨다. 결정성 자체(두 프로세스 동일)는 유지되지만 원작 유도 오라클(SR-5 ②)의 행렬 간격·출발 지점이 원작과 갈린다.
수정: `imul` 을 `al*bl + ((ah*bl + al*bh) % 65536) * 65536` 꼴로 쓰고(각 항 < 2³³), `Sim.luau:838-839` 도 같은 함수를 쓴다. 테스트는 원작 `noise(1,0..7)` 값을 상수로 박아 대조한다.

**B2. 리더 없음 처리가 §R 과 반대다 — `Sim.luau:746-754`, `Sim.luau:736-740`**
`ensureLeader` 가 금화 ≥700 이면 활잡이를 **자동 고용**해 리더로 세운다(`auto = true` 이벤트까지). `spec.md:21` 「자동 고용 없음(원작에 없다)」과 정면 충돌이고, `test-quality.md:20` 14행이 회귀로 지목한 바로 그 코드다. 또 후보 탐색(`736-740`)이 비주둔자만 보고, 스펙의 「없으면 주둔자를 철수시켜 승계」가 없다.
수정: `746-754` 삭제. 후보가 없으면 주둔자 중 ID 최소를 `leaveTower(u, t, ejectPosition(s,t))` 로 빼서 승계하고, 그마저 없을 때만 `leaderId = nil`.

**B3. 예산 초과 탐색을 재개하지 않아 긴 경로는 영원히 못 찾는다 — `Grid.luau:250`, `Sim.luau:206-211`**
`findPath` 가 `budget` 을 돌려주면 `navigate` 는 `route.path` 도 `retry` 도 안 바꾸고 다음 틱에 **처음부터** 다시 256 을 쓴다. 닫힌 노드 256 을 넘는 탐색(54×52 에서 고지 27×21 셀 덩어리를 돌아가는 경로는 쉽게 넘는다)은 틱마다 256 을 태우며 제자리에 선다 — 추종자 24명이 그 상태면 전역 2048 이 매 틱 바닥난다. 원작은 `search` 객체를 route 에 보존해 이어 찾고 보존 수를 4로 묶는다(`sim.js:252-263`, `world.js:100-142`).
수정: `findPath` 가 `search`(open·cost·parent·closed) 를 받아 이어 가게 하고 route 에 보존, 보존 상한 4 를 원작대로. 또는 호출 상한을 격자 전수(2808)로 올려 단일 틱에 끝내되 전역 2048 을 함께 올린다 — 전자를 권한다.

**B4. NaN·비문자열 입력이 거부가 아니라 런타임 오류가 된다 — `Sim.luau:513`, `Sim.luau:571`, `Sim.luau:448`**
`seen[id] = true` 를 `ownedUnit` 검사보다 먼저 하므로 `unitIds = {0/0}` 이면 `table index is NaN` 으로 `Sim.act` 가 죽는다. `heroSkill` 은 `c.skill` 을 검사하지 않아 비문자열이면 `skill .. "ReadyTick"`(`448`)에서 오류, `"multishot"` 아닌 문자열은 전부 구르기로 흐른다(`463`). SR-3 스키마가 앞에서 거르더라도 SR-5 「NaN·문자열 id → ok=false 이고 상태 동일」(`spec.md:62`)은 Sim 단독 테스트라 지금 코드로는 빨간불이 아니라 예외다.
수정: `unitIdsOf`·`combine` 에서 `type(id)=="number" and id==id` 를 먼저 보고, `heroSkill` 첫 줄에서 `skill ∈ {multishot, roll}` 을 검사해 `INVALID_TARGET` 또는 `SKILL_UNAVAILABLE` 로 거부.

**B5. `ownerId` 가 userId 면 리더가 맵 밖에서 태어난다 — `Sim.luau:84-86`**
`x = s.base.x + ownerId * 1.5`, 이름 `"원정대 " .. (ownerId + 1)` 은 ownerId 를 슬롯 0/1 로 가정한다. §R 은 「소유자 슬롯은 userId 에 결속」(`spec.md:23`)이라 서버가 userId → 슬롯 변환을 하지 않으면 x ≈ 10⁹ 에서 `cellAt` 이 nil 이 되어 리더가 걷지도 쏘지도 못한다.
수정: `Sim.addOwner` 에 「ownerId 는 0/1 슬롯」을 명시하고 2 이상이면 nil 을 돌려준다. 서버 세션이 userId ↔ 슬롯 표를 갖는다(스펙 SR-3 「세션에서 붙인다」와 맞다).

**경미**
- `Sim.luau:708` 거부 뒤 `owner.leaderPos` 를 남겨 둔다. 한 Heartbeat 에 3틱이 돌면 같은 좌표를 3번 거부해 `correct` 이벤트·되돌림 횟수가 3배로 찍힌다. 거부 시 `leaderPos = nil`.
- `Sim.luau:1063` `math.min(dt, 0.25)` 는 7틱까지 허용한다. §R 「Heartbeat 당 최대 3틱」(`spec.md:35`)은 서버가 dt 를 0.1 로 잘라 넘겨야 성립하므로 SR-3 에 그 한 줄을 적거나 `Sim.step` 상한을 0.1 로 내린다.
- `Balance.luau:57` 거점 구성이 좀비 2 로, §R 「25마리 zombie 15·plague 5·bat 5」(`spec.md:26`)와 다르다. 스펙 문제가 아니라 미구현.
- `src/shared/Packet.luau` 가 있는데 §R 공개 면(`spec.md:34`)의 넷(Sim·Grid·Balance·Theme)에 없다. server·client 둘 다 쓸 모듈이므로 목록에 넣거나 Sim 안으로 접는다 — `verify.py` require 검사가 어느 쪽인지 정해야 한다.

### 스펙 문장 보완 (비차단)
- SR-5 「스냅샷 복원 뒤 N틱 == 원본 N틱」(`spec.md:62`): 경로 캐시는 상태 밖이라(`Sim.luau:38-43`, 원작도 `sim.js:208` WeakMap) 진행 중 경로를 가진 원본과 새로 탐색하는 복원본은 몇 틱 뒤 갈린다. 원작 테스트는 1틱만 비교한다(`snapshot-codec.test.mjs:36-37`). N=1 로 못 박거나 「복원본 둘을 N틱」으로 바꾼다.
- §R 리더 위치의 허용 거리 `속도×dt×2+0.5`(≈1.42 스터드/틱)는 Heartbeat 간격 >0.1초에서 정상 걸음도 되돌린다. 3틱 상한과 같은 수치라 모순은 아니지만, 되돌림 로그를 「프레임 간격 >0.1초」와 함께 찍어야 원인이 갈린다.

### 판정
스펙 결정은 모두 구현 가능하고 코드와 충돌하는 결정은 없다. B2 는 코드가 스펙을 어긴 것이지 스펙이 틀린 것이 아니므로 사람 판단이 필요 없다. 코드 버그 B1~B5 를 고치고 SR-5 문장 하나를 다듬으면 된다.

VERDICT: REVISE
