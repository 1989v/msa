# T03A-1 · 순수 활공 규칙

2026-09-12. Skybound PRD SR-2와 기존 T02A 이동 계약만 사용한 독립 규칙이다.
**플레이 화면에는 아직 연결하지 않았다.** viewer·모델·기존 simulation은 수정하지 않았다.
DOM/Three.js/설치 의존성이 없고 위치 적분·지형 충돌·전체 이동을 중복 구현하지 않는다.

```sh
node --test docs/specs/2026-09-10-skybound/implementation/t03a/tests/gliding.test.mjs
```

실행 결과 **tests 8, pass 8, fail 0**. 전개/접기/착지/리셋, 소진/재전개,
공유 기력, 기류 경계/중첩, 속도 변화 제한, 일정 조건에서 시간 분할 동등성,
불변 결과/잘못된 입력, 틱 중간 소진의 시간 분배를 확인했다.

## API

```js
const next = stepGliding(
  { deployed: false, stamina: sharedStamina, velocityY },
  { dt: 1 / 120, grounded, position: { x, y, z },
    actionPressed: false, sprinting: false, reset: false },
  [{ x: 0, z: 0, radius: 3, minY: 0, maxY: 10, speed: 4 }],
);
// frozen { deployed, stamina, velocityY, windSpeed, glidingTime }
```

매 호출에 현재 공유 기력과 수직 속도를 공급한다. 내부 상태나 두 번째 기력 소유자는
없다. 입력은 바꾸지 않고 결과를 freeze한다. dt는 유한한 0–1/30초이며 T02A의
1/120초 fixed tick에 연결하는 것을 전제로 한다. 범위 밖 dt는 버리지 않고 거부한다.
dt=0의 액션은 소비하지 않으므로 입력 계층이 다음 실제 틱까지 pulse를 보관해야 한다.

기류는 수직 원기둥이다. 수평 거리 **≤ radius**, **minY ≤ y < maxY**에서 유효하다.
중첩은 가장 강한 speed만 선택하며 6m/s로 제한한다. 0인 speed는 회복 기류가 아니다.
접힌 돛은 기류의 상승·회복을 받지 않는다. 0 기력에서 돛을 자동으로 펼치거나
기류를 이용해 스스로 기력을 되살릴 수 없다. 회복한 뒤 새 press가 필요하다.

## 초기 튜닝 값

`GLIDING` export가 구현 정본이다. 경로 완주나 재미를 검증한 밸런스 값은 아니다.

| 항목 | 초기 값 |
|---|---:|
| 기력 최대 | 100 |
| 활공 소비 | 12/초 |
| 지면 회복 | 28/초 |
| 지면 달리기 소비 | 24/초 |
| 전개 상태의 기류 회복 | 순증가 18/초, 활공 소비를 대체 |
| 일반 활공 목표 하강 속도 | −2.5m/s |
| 기류 목표 상승 속도 상한 | +6m/s |
| 목표 속도까지의 변화율 | 최대 18m/s² |

빠른 낙하에서 전개해도 속도를 즉시 −2.5로 바꾸지 않는다. 목표에 제한된 가속도로
접근한다. 외부 힘으로 이미 +6을 넘은 속도도 즉시 자르지 않고 목표로 감속한다.
따라서 상한은 **기류가 만드는 목표 속도**이며 기존 임의 속도의 즉시 clamp가 아니다.

## T03A-2 연결 순서 / 중복 방지 계약

1. 입력의 press는 **한 소비자에게만** 보낸다. 틱 시작의 grounded/coyote 점프
   가능 여부로 기존 점프가 소비했다면 같은 press를 actionPressed로 보내지 않는다.
   그렇지 않은 공중 재누름만 돛 전개/접기에 사용한다. 점프로 grounded가 false로
   바뀐 뒤 같은 press를 다시 검사하면 즉시 돛이 열리는 버그가 생긴다.
   착지 입력 버퍼를 유지할 때도 같은 pulse를 두 계층에 중복 보관하지 않아야 한다.
2. 기력 갱신은 이 helper 또는 동등한 단일 소유 경로에서 **한 번만** 한다.
   현재 T02A의 sprint drain/ground recovery 줄에 이 결과를 추가 적용하면 이중 소비·
   이중 회복이다. `sprinting`은 실제 ground sprint 상태를 전달하고, 반환 stamina를
   기존 snapshot의 공유 값으로 갱신한다. 기존 exhaustion latch는 이동 쪽에서 유지한다.
3. 공중에서는 **중력 적용 전** velocityY로 helper를 호출한다. 반환 velocityY에는
   활공한 `glidingTime` 동안의 변화만 포함된다. 일반 중력은 남은
   `dt - glidingTime`에만 적용한다. 전개가 틱 중간에 소진되면 deployed=false여도
   glidingTime>0일 수 있으므로 false만 보고 full-dt 중력을 다시 적용하면 안 된다.
   위치 적분/충돌/착지 처리는 기존 simulation이 수행한다.
4. 접지 결과가 확정되면 돛을 닫되 같은 틱의 기력을 두 번 갱신하지 않는다.
   reset은 **돛만 닫으며** 입력 stamina를 범위에 맞추고 velocityY는 보존한다.
   체크포인트·리스폰의 기력 100/속도 0 복구는 기존 simulation의 책임이다.
5. 기존 animation bridge는 gliding mode를 지원하지 않는다. 연결할 때 원본 돛 모델과
   적절한 캐릭터 포즈·bridge 대응을 추가해야 한다. 이 모듈은 unsupported mode를
   기존 viewer에 보내지 않는다. 현재 반환값은 deployed 여부뿐이다.

시간 분할 동등성 검사는 동일한 위치/기류/입력 조건과 전환이 없는 구간에 한정한다.
경계 통과·키 입력·착지 등은 기존 fixed tick 순서대로 평가해야 한다. 실제 기류의
배치·가시적 방향 표식, 경로별 기력 완주, 상하 충돌과 실기기 체감은 후속 검증이다.
