# Usecase review — REVISE

검토일: 2026-10-01. 범위: 계획/시안. spec·planning·tasks·test-quality·design/DESIGN을 함께 검토했다. 조작의 기본 선택/목적지/주둔/건설 흐름은 design/DESIGN에 있으므로 누락으로 판정하지 않았다.

## U1 · P1 · 협동 던전 퇴각/전멸/재입장의 상태 전이가 없음

- 근거: `spec.md` SR-5/SR-6; `planning/world.md:59`, `planning/world.md:60`, `planning/world.md:61`, `planning/world.md:62`, `planning/world.md:63`; `planning/platform.md:72`.
- 저장은 상태 그대로 복원한다고 정했지만 실제 퇴각 후 방의 적HP·스폰 예약·이미 받은 잡몹 보상 유지 여부는 정하지 않았다. 한 명이 남아 있는 던전을 다른 소유자가 나갔다 들어올 때 초기화할 수도 있고, 방 전멸 시에만 초기화하는 구현도 가능하다. '보상 복제 금지'만으로는 구현이 하나로 결정되지 않는다.
- 수정 제안: 캠페인당 던전ID별 공유 인스턴스1개, 첫 방 진입 시1회 스폰 예약, 모든 플레이어가 나가도 적HP/사망/예약/클리어 상태 보존, 재입장 시 이어서 진행하는 기본값을 명시한다. 남아 있는 동료·전원 퇴각·부분 부대 전멸·혼자 보스 처치·다른 소유자 후진입 각각의 전후 상태를 표로 기록한다. 초기화가 의도라면 encounterId와 보상 원장을 함께 정의한다.

## U2 · P2 · 공사 명령의 비용 확정·취소·파괴 상태가 미완성

- 근거: `spec.md` SR-3; `planning/gameplay.md:21`, `planning/gameplay.md:27`, `planning/gameplay.md:47`, `planning/gameplay.md:51`, `planning/gameplay.md:52`; `tasks.md` T3.
- 목수가 짐 반납 후 이동한다는 순서는 있으나220G를 명령 수락/현장 도착/작업 진행 중 언제 차감하는지 없다. 도착 전 취소의 환급, 건설 중 HP·적의 공격 가능 여부, 여러 목수의 작업 중복/가속, 같은 tick의 취소·완공 경쟁을 다음 모델이 결정해야 한다.
- 수정 제안: accepted/travelling/building/paused/completed/cancelled/destroyed 상태표를 추가한다. 제안 기본값은 수락 시 비용 전액 차감·footprint 및 탑 정원 예약, 목수1명만 공정 진행, 도착 전 취소도 진행0의75% 환급, 완공/취소 중 먼저 처리된 terminal 전이만 유효다. 건설 중 HP 산식과 공격 가능 시점 및 파괴 환급0을 명시한다. 모든 수치는 설계 제안으로 유지한다.

## U3 · P2 · 초반 사냥터와 지역별 전투 배치가 미정

- 근거: `spec.md` SR-1/SR-4/SR-5; `planning/world.md:12`, `planning/world.md:14`, `planning/world.md:23`; `planning/gameplay.md:28`, `planning/gameplay.md:76`, `planning/gameplay.md:78`; `tasks.md` T2/T4.
- F는 약한 시체 사냥길인데 초기 수/리젠/캠프 귀속이 없다. 리젠 수만 있는 C2~C6의 초기 병종/개체수, 필드 웨이브 출발점, 던전 '혼합8/호위4' 조합도 없다. 맵 중심점·'C1 통로/C2 우회'만으로는 물리적 문/램프와 파괴 해금 조건이 결정되지 않는다. 첫 목수 획득·초반 웨이브 방어를 구현자가 서로 다르게 만들 가능성이 높다.
- 수정 제안: F/C1~C6/던전 방마다 initial composition, respawn composition, spawn area, aggro/leash, clear predicate를 갖는 콘텐츠 표를 추가한다. 필수 램프/문은 연결 고도와 파괴 조건을 명시하고 T0 지도 근사 범위 확인 후 T2 전에 좌표/영역을 고정한다. 정확한 원본 지형이 확인됐다고 쓰지 않는다. F만 사냥해 첫100G를 얻는 경로와 C1 파괴 후 초반 수입 경로를 검증 시나리오에 넣는다.

## 확인된 장점 / 리뷰 한계

- SR→T1~T8 및 행동/통합/브라우저 검증의 연결은 충분하다. 실제 플랫폼 미기동을 온라인 완료라고 주장하지 않는 구분도 적절하다.
- 새 게임·협동 방 생성·협동 이어하기·단절 후 fork·기존 슬롯 덮어쓰기 경고가 계획에 포함되어 있다.
- 원본 전체 지도 및 신규 시안 승인 문제는 이미 `context/open-questions.yml`에 별도 관리되고 있다. 이번 리뷰가 해당 사실을 검증하거나 승인한 것은 아니다.
- 런타임/테스트/서버/배포는 실행하지 않았다. 위 지적은 다음 구현 세션 전에 계획에서 해결할 항목이다.

## Round 2 — SHIP (계획 인계 기준)

2026-10-01 수정본을 다시 읽고 U1~U3의 해결을 확인했다. 최초 지적은 위에 이력으로 보존하며 현재 판정은 SHIP이다.

| 지적 | 해결 근거 |
|---|---|
| U1 | `planning/world.md:107`의 공유 던전 상태표가 첫입장/동료후입장/한쪽퇴각/전원퇴각·전멸/재입장/동료처치/저장복구를 정의한다. `planning/world.md:114`에서 전원 이탈 시 인스턴스를 보존하고 휴면시킨다. `planning/test-quality.md:56`에 두 소유자 퇴각·보스 처치·재입장 보상 회귀가 있다. |
| U2 | `planning/gameplay.md:91`의 상태표가 수락 시220G 차감과 정원/지면 예약, 도착 전 취소165G, 건설·정지 중 피격, 취소/파괴를 명시한다. `planning/gameplay.md:102`에서 공정별HP·피격손상 보존·목수 가속 금지 및 tick 전이 순서를 고정했다. |
| U3 | `planning/world.md:67`에서 F/C1~C6/던전방/성채 초기 병종·수·리젠·클리어와 aggro/leash, 웨이브 출발점을 명시했다. `planning/world.md:90`에서 필수 램프/문 연결·고도·폭·해금 조건을 고정한다. 상세 지형 polyline/cliff polygon은 T0 근사 범위 확인 후 T2 저작 데이터로 확정하는 명시적 후속 과업이다. |

현재 계획을 인계하는 데 추가 유스케이스 차단 사항은 없다. 원본 전체 지도 검증 및 실제 플레이·네트워크·저장 검증은 후속 작업으로 남으며, 이번 검토에서 통과한 것으로 간주하지 않는다. 런타임 수정이나 테스트 실행은 하지 않았다.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
