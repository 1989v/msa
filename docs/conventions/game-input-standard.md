# 게임 입력 표준 (플랫폼 공통)

> 모든 캔버스 게임은 같은 버튼 문법을 쓴다. 구현체는 `portal-fe/public/games/lib/keys.js`
> (`GameKeys`) — 손잡이 선택은 `localStorage('game_input_layout')` 로 **전 게임 공유**되고,
> 좌하단 배지로 언제든 전환한다. (2026-08-15 사용자 피드백로 제정)

## 표준 레이아웃 (좌/우 손잡이 2종 고정)

| 액션 | 오른손잡이(기본) | 왼손잡이 |
|---|---|---|
| 이동 | 방향키 | WASD |
| 액션1 — 주공격 / (메뉴 보조결정) | C | L |
| 액션2 — 점프 / **메뉴 결정** | X | K |
| 액션3 — 대시/특수 | Z | J |
| 보조1/보조2 — 무기 전환 등 | A / S | U / I |
| **일시정지/메뉴** | Enter (공통) | Enter (공통) |
| **뒤로/취소** | Esc (공통) | Esc (공통) |

> 2026-08-16 재배치: 공격/점프/대시 = C/X/Z (왼손 L/K/J) — 물리 키 집합은 유지, 시맨틱만
> 재배치라 레거시 remap 프로필은 무수정 자동 추종.

- 메뉴/일시정지 키는 레이아웃과 무관하게 모든 게임에서 동일하다 (Enter/Esc).
- 게임 내 도움말·힌트 문구는 `GameKeys.labels()` 로 현재 레이아웃의 키 이름을 표기한다.
- 2인: 온라인 2P(릴레이) 게임은 각자 기기에서 위 표준을 그대로 쓴다. 로컬 동시 2인 게임을
  만들 경우 P1=왼손 레이아웃 고정, P2=오른손 레이아웃 고정.

## 적용 방법

- **신규/개편 게임**: `<script src="../lib/keys.js">` 로드 후 `GameKeys.keys()` 로 물리 키를
  받아 자체 입력 매핑을 구성하고 `GameKeys.onChange()` 로 전환에 반응한다.
  레퍼런스: `nova-strike/js/input.js`.
- **레거시 게임(코드 무수정)**: `GameKeys.remap({ left:'ArrowLeft', a1:'Space', pause:'KeyP', ... })`
  — 표준 키 입력을 게임이 원래 듣는 키로 변환 재디스패치한다. 게임별 remap 프로필 한 줄만
  추가하면 된다.
- 모바일(`lib/touch.js`)은 KeyboardEvent 를 합성하므로 remap/매핑 위에 자동으로 얹힌다.

## 롤아웃 상태

- [x] `lib/keys.js` + 손잡이 배지
- [x] `nova-strike` (레퍼런스 — 네이티브 매핑 + 라벨 연동)
- [x] 1차 스윕 슬라이스 (2026-08-15): `cave-glide`(a1/a2→Space), `crimson-ravine`(s1/s2→Q/W) remap 부착 · 검증 완료.
  `storm-corridor`(방향키+WASD 동시 수용)·`iron-vanguard`(마우스+Esc)는 **이미 표준 부합** 판정
- [x] **전체 스윕 완료** (2026-08-15, 멀티에이전트 워크플로 49종): remap 부착 9종
  (beat-dojo, bracket-battle, dawn-ward, depth-delver, drift-continent, moon-angler,
  overworld-quest, raging-fist-saga, rift-front) · 이미 부합 11종 (abyssal-crown, nether-return,
  snake, monster-tamer, echo-duel 등) · 마우스/터치 전용 25종 · 타이핑 게임 보호 제외 4종
  (acid-rain, sketch-sleuth, word-chain, word-warden)
- 스윕에서 나온 keys.js 보강: **input/textarea 포커스 중 가로채기 금지**(세이브 코드 입력 보호),
  Space 합성 시 key=' ' 정합
