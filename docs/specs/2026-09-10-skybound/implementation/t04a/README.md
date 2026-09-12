# T04A-1 · 물체 조작 순수 규칙

Skybound PRD SR-3의 단일 돌/프리즘 운반 규칙만 구현했다. 렌더러, 입력 장치,
이동 코어, 저장, 받침/퍼즐 완료에는 아직 연결하지 않았다. 다른 게임 자료나 외부
의존성을 사용하지 않는다.

```sh
node --test docs/specs/2026-09-10-skybound/implementation/t04a/tests/manipulation.test.mjs
```

7/7 검사 통과. 빌드가 필요 없는 독립 ES module이다.

## 호출 계약

`createManipulation({objects,walls=[],reach=4,lineOfSight=()=>true})`는
`snapshot()`, `dispatch(action,frame)`, `committedSnapshot()`을 반환한다.
objects는 `{id,kind:'stone'|'prism',size:{x,y,z},position:{x,y,z},yaw:0}` 목록이다.
설정에 등록된 고유 ID만 선택할 수 있다. position은 상자 중심이며 음수 좌표도
허용한다. size/사거리는 양수 유한 값, yaw는 도 단위 90의 배수만 허용한다.
음수/여러 바퀴 회전은 0/90/180/270으로 정규화한다. 모든 설정은 복제한다.

frame은 현재 `{eye:{x,y,z},player:{min,max},walls?:[{min,max}]}`다.
고정 walls와 현재 frame walls를 합쳐 검사하며 grab/drop에도 반드시 현재 frame을
제공한다. eye에서 대상 중심까지 기본 4m 사거리와 실제 AABB slab 시선을 검사한다.
추가 `lineOfSight(from,to)`는 차단을 더할 수 있으며 true만 통과로 취급한다.
콜백 입력은 동결하고, 외부 형상 검사에 숨은 상태 변경이 없도록 호출자가 책임진다.

actions:

- `{type:'select',id}` → 가시/사거리 검증 후 선택. 운반 중 다른 선택/집기 금지.
- `{type:'grab'}` → 현재 선택의 가시성/사거리/겹침 재검증 후 단일 운반 시작.
- `{type:'move',position}` / `{type:'rotate',yaw}` → 사거리/시선/최종 겹침/쓸고 가는 경로 검사.
- `{type:'drop'}` → 현재 preview 또는 held 위치를 다시 검증하고 성공 때만 확정/해제.
- `{type:'cancel'}` → 운반을 버리고 마지막 확정 위치로 복구.
- `{type:'pause'|'resume'}` → 운반 동작 정지/재개. pause 중 취소도 거부한다.
- `{type:'reset'}` → 원래 배치/선택/운반/preview를 초기화하고 정지를 해제한다.

결과는 `{ok,state,reason?}`이고 snapshot은 깊게 동결된다. 알려진 행동이지만
수행할 수 없으면 range/occluded/overlap/sweep/held 등 reason을 반환한다.
잘못된 타입/비유한 값/잘못된 yaw는 예외로 거부하며 상태를 바꾸지 않는다.
배치가 불가능한 move/rotate는 held 실제 pose와 확정 위치를 유지하고
`preview:{pose,valid:false,reason}`만 갱신한다. 거부된 drop은 상태도 바꾸지 않는다.

## 충돌과 복구 한계

90도 회전 끝점의 상자 크기는 X/Z를 실제로 바꾼다. 이동은 장애물/다른 물체/플레이어
AABB를 운반 상자의 반크기만큼 확장한 뒤 중심 선분 slab 검사로 통과를 막는다.
회전 중에는 XZ 대각선 반지름의 보수적 정사각 범위를 사용한다. 따라서 회전 끝점이
비어 있어도 중간 모서리가 장애물에 닿을 수 있으면 거부하며, 일부 실제로 가능한
회전도 거부할 수 있다. 정밀 OBB 연속 충돌이나 범용 물리가 아니다.
순수 경계 접촉은 허용하고 내부 침범을 막는다(수치 허용오차 1e-9).

**cancel/reset은 배치 검증을 통과한 이동이 아니라 복구용 순간 재배치다.**
운반 후 플레이어가 원래 위치에 들어섰다면 복구 물체와 겹칠 수 있다. 후속 연결자는
조작/플레이어 이동을 정지하고 안전 위치로 플레이어를 옮기는 등 겹침을 해결한 뒤
다시 진행해야 한다. 이 순수 모듈만으로 모든 상황의 SR-3 무관통 완료를 주장하지 않는다.
지형 받침, 중력, 바다 판정/회수, 플레이어 자동 이동과 동적 물체 물리는 포함하지 않는다.

`committedSnapshot()`은 운반/preview를 제외한 마지막 확정 물체 목록이다.
렌더 연결자는 held ID의 확정 mesh를 중복 표시하지 않고 held pose를 표시해야 한다.
이 목록은 **게임 저장 스키마가 아니다**. SR-3의 미완료 유적 초기 배치 복원과 완료된
받침 고정 복원은 다음 저장/퍼즐 계층이 처리해야 한다.

검사는 등록/값 검증·설정 불변성, 오래된 선택의 벽/거리 재검증, 단일 소유권,
접촉 경계, 얇은 벽/다른 물체를 가로지르는 경로, 회전 모서리 범위, 유효하지 않은
preview의 비확정, drop 시 추가 벽 재검증, pause/cancel/reset과 예외 원자성을 확인한다.
