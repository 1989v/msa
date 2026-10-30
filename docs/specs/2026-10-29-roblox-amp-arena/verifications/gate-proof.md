# 게이트 증명 — 회귀 주입 46건 전부 빨강 (2026-10-29, 개정 2026-10-30)

프로젝트 사본(`dist` 제외)에 회귀를 하나씩 넣고 `tools/verify.py` 를 돌렸다. 원본은 건드리지 않았다. 스크립트는 세션 스크래치패드 `gate_proof.py`(레포에 두지 않음 — 검사용 임시 코드).
2026-10-30 추가 주입 Z10~Z21: 실제 있었던 `flatLook` nil 인덱스 버그(Z10), 봇 교전 거리 고정(Z11), 잡기 거리 가산(Z12), 스타일 간 포즈 공유(Z13), 마우스 약공·쉬프트락·E 줍기(Z14~Z16), 대기 자세가 다리까지(Z17), 판정 무시(Z18), 내딛기·대시·놓기 제거(Z19~Z21). Z10·Z18~Z21 은 스모크(쉼 실행)만이 잡는다.

```sh
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 gate_proof.py roblox/amp-arena
```

| 주입 | exit | 첫 빨간 줄 |
|---|---|---|
| A 카메라를 Scriptable 로 | 1 | `SMOKE 31 checks, 0 failed` |
| B 줌 범위 8~60 | 1 | `SMOKE 31 checks, 0 failed` |
| C 아바타 R15 로 | 1 | `SMOKE 31 checks, 0 failed` |
| D Poser 를 RenderStepped 로 | 1 | `SMOKE 31 checks, 0 failed` |
| E 키 안내 문자열 추가 | 1 | `SMOKE 31 checks, 0 failed` |
| F 줍기를 E 키 바인딩으로 | 1 | `SMOKE 31 checks, 0 failed` |
| G 넉백을 BodyVelocity 로 | 1 | `SMOKE 31 checks, 0 failed` |
| H 체력을 Items 가 직접 깎음 | 1 | `SMOKE 31 checks, 0 failed` |
| I Combat 시계를 os.clock 으로 | 1 | `FAIL jab 피해가 Humanoid.Health 에 들어갔다: 100 / 100` |
| J 서버 모듈 순환(Combat → Items) | 1 | `FAIL server Combat.luau + Bots.luau executed on the Roblox shim (tests/roblox-shim.luau): ? runtime checks — hits land, chains, dash, guard, grab/throw, launch→` |
| K OnServerEvent 가 validate 를 건너뜀 | 1 | `SMOKE 31 checks, 0 failed` |
| L 줍기 서버 거리 검사 제거 | 1 | `SMOKE 31 checks, 0 failed` |
| M 봇 절벽 탐침 제거 | 1 | `FAIL 봇이 절벽(z=-10) 앞에서 멈추고 떨어지지 않는다: z=-27.124833333333346` |
| N 봇 상한 20 | 1 | `SMOKE 31 checks, 0 failed` |
| O FallenPartsDestroyHeight 를 fallY 위로 | 1 | `SMOKE 31 checks, 0 failed` |
| P 맵 스폰 팀을 전부 1 로 | 1 | `SMOKE 31 checks, 0 failed` |
| Q 액세서리 템플릿 하나 삭제 | 1 | `SMOKE 31 checks, 0 failed` |
| R 경직을 후딜+발동보다 길게(규칙 검사) | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_3uadcl3g/amp-arena/tests/rules.spec.luau:10: 경직 < 후딜+다음 발동 fighter:jab` |
| S 남의 액세서리 허용(규칙 검사) | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_ebf9yhy2/amp-arena/tests/rules.spec.luau:10: 스타일 외 액세서리는 맨손` |
| T 타격 포즈에서 팔을 안 뻗음(포즈 검사) | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_6o_g2_te/amp-arena/tests/rules.spec.luau:10: 타격 무브는 지속 구간에 팔·다리·몸을 뻗는다 rk1` |
| U 장비를 매치 중에도 받음 | 1 | `SMOKE 31 checks, 0 failed` |
| V 공유 모듈이 Vector3.new 사용 | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_iysmkcxi/amp-arena/tests/rules.spec.luau:7: error while running module: /private/var/folders/ph` |
| W Commands 버스트 초과를 통과시킴(규칙 검사) | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_kvi_g340/amp-arena/tests/rules.spec.luau:10: 같은 순간 버스트 상한` |
| Y validate 를 부르되 결과를 무시 | 1 | `SMOKE 31 checks, 0 failed` |
| Z1 Items 에 Heartbeat 하나 더 | 1 | `SMOKE 31 checks, 0 failed` |
| Z2 Guard 속성을 매 틱 쓰기 | 1 | `SMOKE 31 checks, 0 failed` |
| Z3 그림자 Hp 속성 | 1 | `SMOKE 31 checks, 0 failed` |
| Z4 CharacterAutoLoads 를 true 로 | 1 | `SMOKE 31 checks, 0 failed` |
| Z5 공통 정리 함수를 없앰(정의·호출 전부 다른 이름으로) | 1 | `SMOKE 31 checks, 0 failed` |
| Z6 Commands 가 상위 폴더를 문자열 require | 1 | `SMOKE 31 checks, 0 failed` |
| Z7 hitScan 이 팀 검사(canHit)를 건너뜀 | 1 | `SMOKE 31 checks, 0 failed` |
| Z8 결과 단계 얼림이 속도 제약을 안 끔 | 1 | `SMOKE 31 checks, 0 failed` |
| Z9 KO 크레딧을 Health 뒤에 적음 | 1 | `SMOKE 31 checks, 0 failed` |
| X 에셋 파일 변조 | 1 | `SMOKE 31 checks, 0 failed` |
| Z10 flatLook 이 root.CFrame 을 읽음(실제 있었던 버그: 판정·대시 때 nil 인덱스) | 1 | `FAIL server Combat.luau + Bots.luau executed on the Roblox shim (tests/roblox-shim.luau): ? runtime checks — hits land, chains, dash, guard, grab/throw, launch→` |
| Z11 봇 교전 거리를 7 스터드 고정으로 | 1 | `FAIL 봇은 교전 거리(3.0) 안에서 공격한다: 6.10` |
| Z12 잡기 범위에 몸 반지름을 더함(약공 사거리 안이 전부 잡기) | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_2_hmsywc/amp-arena/tests/rules.spec.luau:10: 그래플러 잡기 범위(중심 거리, 몸 반지름 안 더함)` |
| Z13 스피드스타 1타가 파이터 잽 포즈를 공유 | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_qe437crs/amp-arena/tests/rules.spec.luau:10: 포즈 템플릿 punchL 를 fighter 와 speedster 가 같이 쓴다(quick1` |
| Z14 약공을 마우스 왼쪽 클릭으로 | 1 | `SMOKE 31 checks, 0 failed` |
| Z15 쉬프트락 토글 켬(Shift 대시와 겹침) | 1 | `SMOKE 31 checks, 0 failed` |
| Z16 줍기 프롬프트 키를 E 로 | 1 | `SMOKE 31 checks, 0 failed` |
| Z17 대기 자세가 다리까지 씀 | 1 | `/private/var/folders/ph/y0b21nzx597650trbnnzdy640000gn/T/ampgate_vmtzd5cq/amp-arena/tests/rules.spec.luau:10: 대기 자세 상체만 fighter` |
| Z18 판정이 한 번도 안 맞음(hitTest 결과 무시) | 1 | `FAIL jab 피해가 Humanoid.Health 에 들어갔다: 100 / 100` |
| Z19 내딛기 제거 | 1 | `FAIL 내딛기(stepIn)로 공격자가 앞으로 움직였다: z=0` |
| Z20 대시가 움직이지 않음 | 1 | `FAIL 대시로 앞(−Z)으로 이동: z=0` |
| Z21 잡힌 쪽을 놓을 때 PlatformStand 를 안 풂 | 1 | `FAIL 놓인 뒤 PlatformStand 해제` |

46/46 RED
