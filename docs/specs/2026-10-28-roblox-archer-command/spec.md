# Specification — 궁수 키우기 로블록스판 · 시작 분지

개정 1 (2026-10-28): 6차원 리뷰(`context/review-*.md`) 반영. 바뀐 결정은 §R 에 모았다.
개정 2 (2026-10-28): 2차 리뷰 잔여(도메인 3 · 테스트 F1 · 보안 잔여 1 · 유즈케이스 R1~R3 · 구현 B1~B5) 반영. 3차 리뷰는 돌리지 않았다 — 상수·문장 수준이라 `status.md` 에 항목별 처리를 적는다.

## Goal
`marine-command`(궁수 키우기)의 시작 분지 60분을 Roblox 에서 그대로 놀 수 있게 만든다: 활잡이 공방 강화 → 사냥 → 목수·병력 고용 → 채집·탑 건설·주둔 → 영웅 합성 → 웨이브 방어. 규칙·수치·리듬은 원작 코드를 따르고(planning/requirements.md 표), 구성은 Roblox 에 맞춘다.
결과물: `roblox/archer-command/` — 편집 가능한 Luau 소스, 결정적 빌더가 만드는 `dist/ArcherCommand.rbxlx`, 공식 `luau` 로 실행하는 검증.

## User Stories
- 플레이어는 Studio 에서 Play 를 누르면 어두운 숲 분지의 목책 본진에 활잡이로 서 있고, 8초 뒤 동쪽 전초기지 쪽에서 밀려오는 정찰 좀비를 자동 사격해 금화를 번다.
- 원작 안내 순서대로 먼저 공업 3·방업 2 를 올리고, 500G 가 모이면 목수를 고용해 숲·광석 채집으로 자동 수입을 만들고, 700G 로 활잡이를 늘린다.
- 탑을 지어 병력을 주둔시키고, 북쪽 고지의 가시 첨탑 둘과 주둔 25마리를 뚫어 거점을 부수고, 활잡이 셋을 영웅으로 합쳐 Q/E 를 쓴다.
- 친구가 같은 서버에 들어오면 호스트가 수락한 뒤 각자 지갑·병력으로 같은 본진을 지킨다.

## §R 리뷰 반영 결정 (요약)
| 주제 | 결정 |
|---|---|
| 액터 표시 | 서버 Workspace 에는 지형·탑·플레이어 캐릭터만. 적·동료·목수·투사체·예고 표식은 **클라이언트가 그린다**. 서버는 10Hz 로 `buffer` 로 압축한 액터 목록(id·종류·x·z·방향·HP 비율·깃발)과 사건(발사·피격·처치·예고)을 RemoteEvent 로 보내고 클라이언트가 100ms 보간한다. 한 패킷 ≤ 4KB, 액터는 가까운 순 최대 240 |
| 리더 위치 | 클라이언트 캐릭터가 걷되 **서버가 틱마다 검사**: 직전 수용 위치 대비 `속도×dt×2+0.5` 안이고 통행 셀이며 직선 통행이면 수용, 아니면 Sim 위치로 `PivotTo`(되돌림 횟수 로그). 역방향 쓰기는 구르기·리스폰(= 리더 승계·고용 시 새 리더 좌표로 PivotTo)·되돌림·이어하기 넷뿐. 되돌림 로그에는 프레임 간격을 함께 적는다. Jump 비활성·기본 Health 스크립트 제거·`CharacterAutoLoads=false`·WalkSpeed 는 서버가 틱마다 다시 쓴다(= 살아 있는 추종 전투 병력 중 최저 속도, 원작 squad 속도) |
| 체력 원천 | 리더 HP·사망은 Sim 유닛 HP 뿐. 서버가 `Humanoid.Health` 를 덮어쓰고 `Died`·`Health` 변화는 입력으로 쓰지 않는다(`BreakJointsOnDeath=false`, Dead 상태 비활성) |
| 리더 없음 | 자동 고용 없음(원작에 없다). 전투 병력 0 이면 「리더 없음」 상태: 캐릭터는 본진에서 관전(걷기만, 사격·피격 없음), 고용 패널이 열려 있고 활잡이/장궁수를 사면 그것이 리더. 새 리더 후보는 비주둔 전투 병력 ID 순, 없으면 주둔자를 철수시켜 승계. 패배 조건은 원작 그대로(모든 소유자 금화<500 **이고** 유닛 0 — 목수도 유닛) |
| 리더 명령 | 리더는 garrison 거부(`LEADER`). combine 에 리더가 들어가면 영웅이 리더가 된다. heroSkill 대상은 리더가 영웅이면 리더, 아니면 추종 영웅 ID 순. 리더 구르기는 서버가 9틱 동안 캐릭터를 옮기고 입력을 무시한다 |
| 협동 | `MaxPlayers=2`. 소유자 슬롯은 userId 에 결속(같은 userId 재입장 = 같은 슬롯). 스냅샷의 소유자 슬롯은 userId 를 포함하고, 이어하기 뒤 둘째 슬롯은 같은 userId 만 차지한다 — 다른 사람은 빈 슬롯이 없으면 수락 뒤에도 관전. 수락 시 손님에게 「이 원정은 호스트 계정에 저장됩니다」 토스트. 두 번째 사람은 **호스트가 수락**해야 소유자가 되고(HUD 「OO 님이 참가하려 합니다 · 수락/거절」), 수락 전·세 번째 사람은 관전(명령 전부 거부). 수락 시 캠페인 coop 전환: 본진 max+2000·hp+2000, 둘째 소유자 활잡이 1·금화 0, 기존 적·거점 HP 그대로, 이후 생성분만 ×1.5·웨이브 ×1.4·보상 ×1.5 는 전환 뒤 처치 전부(원작은 처치 시점의 mode). 한 명이 나가도 coop 유지 |
| 저장 | 캠페인 키는 **호스트 userId 하나** (`ArcherCommand_v1/<hostUserId>`). 손님은 저장하지 않는다(명시). 스냅샷 = Sim 자체 직렬화 + `version`·`mapVersion`·`campaignId`·`savedTick`·`savedAt`. 로드 결과 넷: 없음/정상/버전 불일치/읽기 실패. 불일치·실패는 기록 보존, 새 원정은 확인 뒤에만 덮어쓴다. 저장은 「정상 로드 또는 새 원정 확정」 뒤에만(그 전엔 타이머·퇴장·BindToClose 전부 no-op). `UpdateAsync` 로 쓰고 기존 `savedTick` 이 더 크면 포기. 퇴장·BindToClose 는 「저장 중」 플래그로 합친다. 저장소는 함수 주입(`Save.new(update)`)이고 Studio 에서는 메모리 저장소 + HUD 「TEST」 표시 |
| 시작 | 선택(이어하기/새 원정)이 끝나기 전에는 Sim.step 을 시작하지 않는다. 이어하기 확정 틱에 캐릭터를 리더 좌표로 PivotTo |
| 거점 | C1 주둔 25마리(zombie 15·plague 5·bat 5, `campComposition(0)`), 20초마다 25까지 보충, 거점 자체가 가시 예고 사격(340/12/1.6초). **웨이브 구성의 거점 수 비교는 원작 총수 5 기준**(`cleared>=5`·`cleared>=3`)이라 분지에서는 시간 조건(180초 5종 · 480초 6종)만 작동한다 — C1 파괴 직후 웨이브에 armored·vampire 가 섞이지 않는다 |
| 사냥터 | 분지 안 사냥 좀비는 정규 웨이브 입구 (1376,11200) 에 선다(원작 900px 규칙). 길 위 무리는 분지 안에 **없다** |
| 웨이브 출발지 | 전초 탑·파수꾼 **하나라도** 살아 있으면 (960,11808), 둘 다 죽으면 (1376,11200) |
| 웨이브 타이머 | 웨이브 요청이 대기열에 남아 있으면 다음 웨이브를 만들지 않고, 전량 방출된 시점에 타이머가 다시 15/35초로 선다. 동시 상한 150 은 방출을 늦춘다(측정값을 남긴다) |
| 입력 | Esc·Tab 키 안 쓴다(패널 닫기 버튼·오른쪽 위 X). PlayerList CoreGui 끔. 점프 끔·터치 점프 버튼 숨김. 액션 버튼은 화면 오른쪽 세로열(스틱·점프 영역 밖). Q/E 는 「무장 → 지면 탭/클릭 → 발동, 다시 누르면 취소」. 탭 판정 순서: 스킬 조준 > 배치 > 적 카드 > 아군 > 탑. 배치는 탭으로 위치, 확인 버튼으로 건설. R 귀환 없음 — 본진 방향 표시만. skillHold 해제는 `Humanoid.MoveDirection.Magnitude > 0` |
| 카메라 | 머리 위 피치 62°·거리 150/120/96. 경계 클램프 **없음**. 대신 테두리 벽 높이 24 + 바깥 어두운 바닥 + FogEnd 180 |
| 경로 예산 | 원작 그대로: 틱당 전역 2048, 호출당 256, 웨이브 표적 512/96. 격자는 분지 54×52 로컬 |
| 결정성 | LCG 는 2^53 안의 곱(1664525×2^32 < 2^53)이고, 잡음 함수의 32비트 곱은 16비트 분할로 한다. 상태 해시는 키 정렬 직렬화 |
| 공개 면 | `Sim.create/addOwner/act/step/tick/setLeader/squadSpeed/snapshot/restore/view/tutorial`. server·client 가 require 하는 shared 모듈은 Sim·Grid·Balance·Theme·Packet 다섯뿐(`verify.py` 가 require 목록 검사). Campaign 은 Sim 내부. `addOwner` 의 ownerId 는 슬롯 0/1 이고 그 밖은 nil |
| 틱 상한 | `Sim.step` 이 dt 를 3틱(0.1초)으로 자른다. 초과 횟수를 요약에 싣는다 |

## Specific Requirements

### SR-1 월드 (빌더 산출)
- 좌표: 원작 px ÷ 8 = 스터드. 분지 로컬 원점은 원작 (0,10624). X=x/8, Z=(y−10624)/8. 고도 1 = +8 스터드. 격자 셀 4 스터드, 54×52.
- `Grid.luau` 의 `RECTS`(한 줄 한 사각형, 숫자 리터럴만) 와 `SITES` 가 지형 단일 소스. 빌더는 그것을 정규식으로 읽고, 검증은 **실행한 Grid.luau** 가 덤프한 셀과 XML 파트를 대조한다(§SR-5).
- 빌더가 만드는 것: 저지 바닥(Grass), 테두리 벽(Slate, 높이 24, 바깥에 어두운 바닥), 고지 절벽·윗면(Slate/Grass), 경사로(WedgePart, 20 스터드에 8 상승), 본진 목책·모닥불·횃불(PointLight), 숲 2·광석 2, 치료사 표식, 전초기지 탑 자리, 동쪽 원정로 문(북벽 위 x160~184, 셀은 blocked) + 「동쪽 원정로 · 다음 단계」 표지.
- Lighting: ClockTime 20.5, 어두운 Ambient, FogEnd 180, Atmosphere 1. SpawnLocation 본진 (40, 0.5, 168).

### SR-2 시뮬레이션 (서버 권위, `src/shared/Sim.luau` 순수 모듈)
- 30Hz 고정 틱. Roblox API 없음. 명령: hire · upgrade · combine · assign · build · cancelBuild · garrison · ungarrison · heroSkill(skill, dx, dz, length). 거부 코드는 원작 `act` 와 같다(요구사항 표 참조). 거부된 명령은 상태를 바꾸지 않는다.
- 리더: §R. 추종자는 리더 주변 황금각 슬롯(≤5.25 스터드), A* 로 따라온다.
- 전투·경제·캠페인·이동·패배: 개정 전과 같고 §R 의 거점·사냥터·웨이브 규칙을 따른다. 승리 없음.
- heroSkill 좌표는 방향에만 쓰고 구르기 끝점·사격 대상은 Sim 이 격자로 정한다. build 의 x,z 는 서버가 셀로 내림해 `canBuild` 를 통과해야 수락한다.

### SR-3 Roblox 서버 (`src/server/`)
- 입장: 소유자 슬롯·관전·협동 수락은 §R. 명령 RemoteEvent: `ownerId` 는 페이로드에서 받지 않고 세션에서 붙인다. 명령별 고정 스키마(hire.kind ∈ {archer,longbow,carpenter} · upgrade.stat ∈ {attack,armor}, count ∈ {1,10} · combine.unitIds 정수 3 · garrison.unitIds ≤24 + towerId · assign.job ∈ {wood,mine,repair,idle} + unitId(+nodeId|towerId) · build.workerId + x,z 유한수 · heroSkill.skill ∈ {multishot,roll} + dx,dz,length 유한수). 타입이 다르면 조용히 버린다. 토큰 버킷 버스트 20·초당 15, 플레이어별 큐 ≤ 8. 로드 미완·관전이면 전부 거부. 거부 코드 횟수를 로그에 남긴다.
- 틱: Heartbeat 누산 ≤3틱. 틱 뒤 리더 되돌림·구르기·리스폰 적용, Humanoid.Health/WalkSpeed 덮어쓰기, 탑 모델 생성/파괴(정적 파트), 10Hz 패킷 전송.
- 저장: §R.

### SR-4 클라이언트 (`src/client/`)
- 액터 렌더링: 패킷에서 모델 생성·재사용·보간, HP 바(BillboardGui), 투사체 선, 예고 원, 처치 연출. 거리순 240 상한.
- 카메라·HUD·패널·입력: §R. HUD 문구는 Roblox 판 표(requirements.md 「안내 문구」)를 따른다.
- 터치: 액션 버튼 44px 이상, 안전영역 반영.

### SR-5 검증 (`tools/verify.py`, `tests/run.luau`, `tools/dump_grid.luau`)
- `tests/run.luau` (실제 Sim 실행): 피해식·강화 비용·고용 가격/상한·합성(atomic, 리더 승계)·거부 무변경(잘못된 owner·count·NaN·문자열 id → ok=false 이고 상태 동일)·거부 코드 표·협동 보상 8/7 분배와 10초 기여 만료·회복 2%/10%·경제 패배 499/500 경계·목수(노드 3명 네 번째 거부 무차감, 수입 타이밍, 운반자 사망 짐 소실, 건설 지시 시 짐 반납 먼저, 건설자 1명·paused·재개, 수리 1G=10HP, 취소 환급)·주둔(걸어서 입장·예약 4·빈 탑 비공격·파괴 시 발자국 밖 배치·리더 거부)·웨이브(첫 8초 80/112, 둘째 160, 방출 완료+15초, 행렬 간격 0.13~0.21/0.45~0.75, 이동 간격 ≥4, 상한에서 손실 없는 배출·cursor 유지)·출발지 전환(하나라도 생존)·파수꾼 leash·귀환 회복·첨탑 예고 0.55초 뒤 12·보상 180 1회·C1 보상 1회+역습·정찰형 HP 12·리더 클램프(한 틱 20 스터드 점프 → 미변경)·리더 없음 전이·협동 전환 수치·스냅샷 복원본 둘을 N틱 돌려 동일(경로 캐시는 상태 밖이라 원본과는 1틱만 비교)·손상 스냅샷 nil·결정성(별도 프로세스 두 번 해시 동일).
- 원작 유도 오라클(`verifications/original-bot.md` · 스크립트 `verifications/orig_bot.mjs`): ① 리더 사격 금지(스냅샷의 cooldown 을 1e9 로 고쳐 restore) 상태에서 첫 웨이브의 본진 첫 피해 시각이 원작 측정 **13.37~14.13초** 의 ±20% 안 ② 리더 본진 정지·자동 사격·`armor<=attack ? armor : attack` 1단씩(합 5)·500G 되면 hire 정책에서 리더 사망 시각이 원작 측정 **23.37~29.40초(시드 1~20)** 의 ±20% 안. 시드 1~20 값을 원작 옆에 표로 남긴다. verify.py 는 원작 `sim.js·campaign.js·map.js` 의 sha256 이 기록과 다르면 이 행을 `STALE` 로 찍고 PASS 를 내지 않는다. 목수 구매 시각은 창이 아니다.
- 패키징: 모든 Luau 컴파일, 미지 전역 검사(허용 목록), server/client 의 require 목록 ⊆ {Sim, Grid, Balance, Theme} (+server 내부), 빌더 결정성, 스크립트 정확 포함, 서비스 배치, **격자 전수 대조**: `luau tools/dump_grid.luau` 가 셀마다 (col,row,blocked,elev,ramp) 를 찍고 verify.py 가 XML 파트 AABB 와 비교 — 통행 셀(고도 e)은 보행 부피 [8e+0.5, 8e+4] 안에 쐐기 아닌 고형 파트가 없다 · blocked 셀은 [8e, 8e+4] 구간에 그 셀을 덮는 고형 파트가 있다 · ramp 셀은 WedgePart 가 덮는다 · 동쪽 원정로 출구 셀은 blocked.
- 게이트 증명: `planning/test-quality.md` 표의 **모든 행**을 스크래치 사본에서 주입해 빨간불 출력을 `verifications/gate-proof.md` 에 명령과 함께 남긴다.
- UNVERIFIED(verify.py 가 줄로 출력, PASS 줄에는 범위 한정 문구): Studio 실행·물리·WalkSpeed 실측·HRP→Sim 지연·클라이언트 액터 240 렌더 프레임·패킷 크기·카메라·배치/조준 레이캐스트·터치 배치·2인 접속·협동 수락 흐름·호스트 단독 이어하기(부재 손님 병력)·DataStore 저장 호출·Lighting 시각·가시 절벽과 격자 LOS 일치. 사용자가 Studio 에서 직접 연다.

## Visual Design
`marine-command/DESIGN.md` 토큰을 `src/shared/Theme.luau` 로. 승인 미술 톤(어두운 숲·돌 절벽·목책 기지·횃불)은 파트 재질과 조명으로. 아군 파란 망토, 적 붉은 톤, 치유 녹색.

## Existing Code to Leverage
- `roblox/infinity-step/tools/build_place.py` · `verify.py` · `tests/run.luau` · `src/server/{Main.server,Ingress,Progress}.luau`.
- `marine-command/js/origin/{sim,campaign,wave-ai,world,map}.js`: 규칙 원본.
- `docs/research/2026-10-26-roblox-development/`.

## Out of Scope
C2~C5, 던전, 북부 전이, 최종 보스, 안개, 협동 복구·분기 병합 UI, 손님 저장, 랭킹, 결제, 원작 PNG 업로드, Roblox 공개·상품.

## Open Questions
`context/open-questions.yml`.
