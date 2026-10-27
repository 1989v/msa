# Architecture review — 궁수 키우기 로블록스판 · 시작 분지

대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/*`
근거 코드: `roblox/infinity-step/` (빌더·검증기·서버 패턴), `portal-fe/public/games/marine-command/js/origin/` (규칙 원본), `docs/research/2026-10-26-roblox-development/README.md`

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 분리 (순수 Sim / Roblox 어댑터 / 클라이언트) | 통과 | `spec.md:24` Sim 은 Roblox API 금지, `spec.md:34` 서버 어댑터, `spec.md:41` 클라이언트. infinity-step `tests/run.luau:1-12` 와 같은 "shared 를 luau 로 직접 실행" 패턴 |
| 의존 방향 (shared ← server/client) | 통과 | Sim 입력은 리더 위치·명령뿐(`spec.md:26`). 단 F2 의 구르기가 역방향 쓰기를 만든다 |
| 외부 통합이 포트를 거치는가 | 조건부 | DataStore 는 `Progress.luau:4` 처럼 `update` 함수 주입이 선례인데 스펙은 저장 경계를 함수로 명시하지 않음 (F3) |
| 모듈 경계 변경 근거 | 통과 | `requirements.md:40-47` 이 Roblox 로 바꾸는 것을 항목별로 적음 |
| 순환 의존 없음 | 통과 | 빌더→Grid.luau 는 읽기만(`spec.md:21`) |
| 인터페이스 표면 최소 | 미흡 | `Sim.luau` 한 모듈에 전투·경제·캠페인·웨이브 AI·경로탐색이 전부 (F5) |
| 얕은 통과 모듈 없음 | 통과 | Theme·Grid 는 빌더·Sim·클라이언트 셋이 쓴다 |
| Seam 현실성 | 통과 | luau CLI 와 Roblox 런타임 둘이 Sim 을 호출 — 어댑터 2개 |
| 삭제 테스트 | 통과 | Sim 삭제 시 서버·테스트·봇에 흩어짐 |

## Findings (심각도 순)

### F1 [High] 액터 복제 경로가 설계돼 있지 않다 — 서버 CFrame 30Hz 는 가장 비싼 선택
- `spec.md:36` "틱마다 Sim.step → 액터 모델 CFrame 갱신(적·동료·목수·탑·투사체 표시)", `requirements.md:42` "경량 모델(파트 몇 개)로 서버가 CFrame 을 움직인다".
- 동시 액터 상한을 합치면 웨이브 150 + 주변 30 + 거점 25 + 전초 2 + 병력 (24+8)×2 + 탑 12 ≈ 285 (`spec.md:29`, `requirements.md:14`). 파트 셋짜리 모델이면 움직이는 파트 ~850 개. 서버 쪽 앵커 파트의 CFrame 변경은 파트마다 속성 복제가 나가므로, 10Hz 상태 요약과 별개로 이 복제량이 클라이언트 수신 예산을 먼저 채운다.
- 투사체는 활잡이 48명 × 0.55초 간격 ≈ 초당 90발(`requirements.md:13`). 서버에서 인스턴스를 만들고 지우면 생성·파괴 복제가 매 발 나간다. 적 HP 를 어트리뷰트로 두면 피격마다 복제가 또 나간다.
- 수정안 (하나를 골라 스펙에 적는다):
  1. 권장: 서버 Workspace 에는 지형·플레이어 캐릭터·탑(정적)만 둔다. 적·동료·목수·투사체 모델은 **클라이언트가 만든다**. 서버는 Sim 상태를 `buffer` 로 압축한 스냅샷(id·종류·x·z·방향·HP 비율)을 `UnreliableRemoteEvent` 로 10~15Hz 보내고, 클라이언트가 보간한다. 투사체는 "발사 이벤트(출발·도착·종류)" 하나로 보내 클라이언트가 그린다. 서버 권위(`spec.md:38`)는 그대로다 — 클라이언트는 그리기만 한다.
  2. 최소안: 액터당 앵커 루트 파트 하나 + 나머지는 Weld, `PivotTo` 는 15Hz 이하, 투사체는 이벤트. 이 경우에도 예산(목표 KB/s/클라이언트)을 스펙에 숫자로 적고 Studio 네트워크 통계로 재는 항목을 "미검증" 목록(`spec.md:52`)에 추가한다.

### F2 [High] 리더 위치 권위가 양방향이다 — 스펙 안에서 서로 어긋난다
- `spec.md:26` "리더 위치는 Roblox 캐릭터가 정하고(서버가 HumanoidRootPart 를 읽어 틱마다 넣는다)" vs `spec.md:38` "클라이언트는 좌표·피해·보유량을 정하지 않는다". 캐릭터 HumanoidRootPart 는 클라이언트가 네트워크 소유자라 사실상 클라이언트가 리더 좌표를 정한다. `README.md:37` 도 캐릭터 물리와 서버 검증을 별개 항목으로 둔다고 적었는데, 스펙은 리더 위치 검증 규칙을 적지 않았다.
- 반대 방향도 있다: E 구르기는 원작에서 Sim 이 유닛 좌표를 옮긴다(`sim.js:596` `unit.roll` → `unit.x/y` 갱신). 리더가 구르면 Sim 이 정한 위치를 캐릭터에 되써야 하는데 `spec.md:27` 은 구르기를 Sim 전투 항목에 두고 캐릭터 반영은 적지 않았다. 리더 사망·교체 리스폰(`spec.md:37`)도 같은 역방향 쓰기다.
- 통행 격자(`spec.md:21,30`)는 추종자·목수에만 적용되고 리더는 물리로 움직인다. 고지 절벽은 8 스터드(`spec.md:17`)인데 기본 JumpPower 50 의 점프 높이는 약 7.2 스터드라 경사로 없이 넘을 수 있는 경계에 있다.
- 수정안: SR-3 에 "리더 위치 규칙" 절을 둔다 — ① 서버가 HRP 를 읽을 때 직전 샘플 대비 `WalkSpeed × dt × 1.5` 안이고 Grid 통행 셀이면 받아들이고, 아니면 마지막 유효 위치로 `PivotTo` 한다 ② 구르기·리스폰은 Sim 이 목표를 내고 서버가 캐릭터를 옮기는 **유일한 역방향 경로**로 명시한다 ③ Humanoid 점프 비활성(`SetStateEnabled(Jumping,false)`, infinity-step `Main.server.luau:265` 선례)과 캐릭터 기본 Health 재생 스크립트 제거를 적는다(Sim 이 Health 를 정한다는 `spec.md:37` 이 그래야 성립한다).

### F3 [High] 협동 저장의 소유 모델이 없다 — 한 캠페인이 두 키로 갈라진다
- `spec.md:39` "소유자 키 `ArcherCommand_v1/<userId>` 에 캠페인 스냅샷(직렬화된 Sim 상태)" + `spec.md:35` 두 번째 입장 시 coop 전환 + `requirements.md:47` 한 명이 나가도 coop 유지. Sim 상태는 본진·적·웨이브·두 소유자의 지갑을 모두 담는 하나의 세계인데, 이것을 두 userId 키에 각각 쓰면 다음이 정의되지 않는다: 두 번째 입장자가 이미 가진 자기 스냅샷은 버려지는가, 60초 자동저장이 두 키를 모두 덮는가, 다음 날 둘이 다른 서버에 따로 들어오면 어느 쪽 세계가 이어지는가.
- `README.md:54` 는 여러 서버가 같은 키를 갱신할 수 있으면 `UpdateAsync` 로 최신 값 기반 갱신을 하라고 하는데, 스펙은 쓰기 방식과 경합 처리를 적지 않았다. infinity-step 은 `Progress.luau:21-26` 처럼 `update(key, transform)` 을 주입받아 테스트에서 메모리로 바꿔 끼운다 — 스펙 SR-5 "저장 왕복" 검사(`spec.md:49`)가 실제 모듈을 재려면 같은 경계가 필요하다.
- 수정안: ① 캠페인 키는 **호스트(첫 입장자) userId 하나**. 두 번째 플레이어는 첫 범위에서 저장하지 않거나(명시), 자기 키에는 "참가 중인 호스트 id" 만 둔다 ② 자동저장·퇴장·BindToClose 는 호스트 키만 `UpdateAsync` 로 쓰고 `savedTick` 이 뒤로 가면 거부한다 ③ 저장 모듈은 `Save.new(update)` 로 함수를 주입받아 `tests/run.luau` 가 메모리 저장소로 왕복을 잰다 ④ Studio 에서는 DataStore 를 열지 않는다(`Main.server.luau:23` 선례).

### F4 [Medium] 격자 단일 소스 검증이 자기 사본을 잰다
- `spec.md:21` 빌더가 `Grid.luau` 의 `RECTS` 를 정규식으로 읽는다(선례: `build_place.py:14-15` Theme 정규식). `spec.md:51`·`test-quality.md:16` "격자 RECTS 와 빌더 파트 일치(셀 샘플링)". 검증기가 RECTS 를 **파이썬으로 다시 읽어** 셀을 만들면 빌더의 읽기와 같은 사본을 비교하는 것이라, Luau 쪽 `Grid.luau` 가 RECTS 를 다르게 해석하거나(정규식이 못 읽는 표현식·주석 처리된 줄) 런타임 격자가 어긋나도 초록이 난다. `test-quality.md:3` 의 원칙("파이썬 모형은 근거가 아니다")과 어긋난다.
- 수정안: `verify.py` 는 `luau` 로 `Grid.luau` 를 실행해 blocked·elevation·ramp 셀을 JSON 으로 덤프받고, 그것을 XML 파트와 대조한다. RECTS 는 "한 줄 한 사각형, 숫자 리터럴만, 표현식 금지" 형식을 스펙에 고정하고 빌더 정규식이 그 형식만 받게 한다. 빨간불 주입에 "RECTS 한 줄을 주석 처리" 를 추가한다.

### F5 [Medium] `Sim.luau` 하나에 다섯 하위 시스템 — 공개 면을 먼저 정해야 한다
- `spec.md:23-32` 는 명령·전투·경제·캠페인·웨이브 AI·이동(흐름장·A*) 전부를 "`src/shared/Sim.luau` 순수 모듈" 하나에 둔다. 원작은 `sim.js`·`campaign.js`·`wave-ai.js`·`world.js` 넷으로 갈라져 있고 `key-decisions.md:11` 의 구현 순서도 "Grid·Balance·Sim" 셋을 말한다 — 스펙 모듈 목록과 어긋난다.
- 서버·클라이언트·테스트·진행 봇이 각자 내부 함수를 끌어 쓰면 Sim 내부를 바꿀 때마다 넷이 깨진다.
- 수정안: SR-2 에 공개 면을 다섯으로 고정 — `Sim.create(seed, mode)` · `Sim.act(state, ownerId, command)` · `Sim.step(state, dt, inputs)` · `Sim.serialize/restore` · `Sim.view(state, ownerId)`(10Hz 요약용). 내부는 `Grid`·`Balance`·`Campaign`·`WaveAI` 로 나누되 **server/client 가 require 하는 shared 모듈은 Sim·Grid·Balance·Theme 넷뿐**이라고 적고, `verify.py` 가 server/client 소스의 `require` 목록으로 이를 검사한다.

### F6 [Low] 서버 틱 루프의 과부하 상한이 없다
- 원작 `sim.js:711-714` 는 dt 를 0.25 로 자르고 30Hz 틱을 몰아 돈다(최대 7틱). Roblox Heartbeat 에서 285 액터 + A* 256/틱을 7틱 몰아 돌리면 프레임이 더 길어져 다음에도 몰아 도는 나선이 생긴다. infinity-step 은 액터가 없어 이 문제가 없었다.
- 수정안: 프레임당 틱 상한(예: 3)을 두고 초과분은 버린다(결정성은 "같은 입력 시퀀스" 기준이라 유지된다). 상한에 걸린 횟수를 10Hz 요약에 실어 Studio 에서 읽을 수 있게 한다.

## 정리
- 레이어·의존 방향·검증 패턴은 infinity-step 선례를 그대로 따라 건전하다.
- 고쳐야 할 것은 세 가지 미정의: 액터 복제 경로(F1), 리더 위치의 권위·역방향 경로(F2), 협동 저장의 소유 키(F3). 셋 다 구현 중에 정하면 되돌리기 비싸므로 스펙에서 정한다.
- 문서·코드 위반으로 사람 판단이 필요한 항목은 없다.

VERDICT: REVISE

## 2차 (개정 1 대조, 2026-10-28)

| # | 판정 | 근거 |
|---|---|---|
| F1 액터 복제 | 해소 | `spec.md:18` 서버 Workspace 는 지형·탑·캐릭터만, 적·동료·목수·투사체는 클라이언트 렌더링. 10Hz `buffer` 패킷 ≤4KB·액터 240 상한, 사건(발사·피격·처치·예고)은 이벤트. `spec.md:66` 패킷 크기·240 렌더 프레임을 UNVERIFIED 로 명시. `requirements.md:46` 일치 |
| F2 리더 권위 | 해소 | `spec.md:19` 서버 틱 검사(`속도×dt×2+0.5`·통행 셀·직선 통행) + Sim 위치로 되돌림, 역방향 쓰기 넷(구르기·리스폰·되돌림·이어하기) 열거, Jump 비활성·기본 Health 스크립트 제거·WalkSpeed 서버 덮어쓰기. `spec.md:20` Humanoid.Health/Died 를 입력으로 쓰지 않음. 점프를 끄므로 8 스터드 절벽 우려도 사라짐. `test-quality.md:19` #13 클램프 검사 |
| F3 협동 저장 | 해소 | `spec.md:24` 호스트 userId 키 하나·손님 저장 없음(`spec.md:77` Out of Scope 에도)·`UpdateAsync` + `savedTick` 역행 거부·`Save.new(update)` 주입·Studio 메모리 저장소. `requirements.md:51` 일치 |
| F4 격자 검증 | 해소 | `spec.md:41` RECTS 형식 고정(한 줄 한 사각형, 숫자 리터럴만) + 검증은 실행한 Grid.luau 덤프. `spec.md:64` `tools/dump_grid.luau` 전수 대조 규칙(통행·blocked·ramp·문 셀). `test-quality.md:3,25` 검증기는 RECTS 를 다시 파싱하지 않음. 빨간불은 내가 제안한 "RECTS 주석 처리" 대신 "절벽 파트 삭제 + 절벽 한 셀 밀기" — 빌더 산출물 쪽을 흔드는 것이라 목적(두 소스의 어긋남 탐지)에 맞는다 |
| F5 공개 면 | 해소 | `spec.md:34` `Sim.create/addOwner/act/step/setLeader/snapshot/restore/view/tutorial` 고정, require 허용 집합 {Sim, Grid, Balance, Theme}, Campaign 은 내부. `spec.md:64` verify.py 가 require 목록 검사, `test-quality.md:24` #18 빨간불 "client 에서 Campaign require" |
| F6 틱 상한 | 해소 | `spec.md:35` Heartbeat 당 최대 3틱·초과분 폐기·초과 횟수 요약 탑재. `spec.md:53` SR-3 틱 절에도 반영 |

남은 미정의 없음. 체크리스트 "외부 통합 포트"(F3)·"인터페이스 표면"(F5) 항목은 통과로 바뀐다.

VERDICT: SHIP
