# card-dispenser

회전판에 옆으로 꽂힌 카드 중 정면에 온 하나가 일어나는 장치. 스크롤로 돌리고, 끌어서 돌리고,
"뽑기"로 두 바퀴 돌려 하나를 세운다. 필터를 건 결과를 그대로 꽂으면 "이 조건에서 아무거나"가 된다.

- 의존성 0 (DOM + CSS 3D). React 를 모른다 — `useEffect` 안에서 만들고 `destroy()` 로 치운다.
- 이 디렉터리는 portal-fe 의 다른 모듈을 import 하지 않는다. 그대로 떼어 별도 패키지로 낼 수 있다.

## 쓰기

```ts
import { createDispenser, escapeHtml } from '../../lib/card-dispenser';
import '../../lib/card-dispenser/card-dispenser.css';

const d = createDispenser(host, {
  items,                                   // 무엇이든
  minCards: 24,                            // 모자라면 있는 것을 돌려 채운다 — 뽑히는 건 실제 항목뿐
  render: (it, i) => `<div class="cd-photo" style="background-image:url(${it.img})"></div>
    <div class="cd-body"><span class="cd-seal">${escapeHtml(it.kind)}</span>
    <b class="cd-title">${escapeHtml(it.title)}</b></div>`,
  onChange: (it) => show(it),              // 정면 카드가 바뀔 때. 스핀 중엔 쉬고 멈춘 뒤 한 번
});
d.setAngle(-scrollProgress * 110);         // 스크롤 스크럽 (터치 기기에서는 하지 않는다)
d.spinTo('random').then(show);             // 뽑기
d.destroy();
```

| 메서드 | 무엇 |
|---|---|
| `setAngle(deg)` | 바깥(스크롤)이 주는 각. 사용자 조작 offset 과 더해진다 |
| `rotateBy(deg)` · `snap()` | 한 칸 넘기기 · 가장 가까운 카드에 맞춰 세우기 |
| `spinTo(i \| 'random', ms)` | 두 바퀴 돌아 느려지며 멈춘다. Promise 로 뽑힌 항목 |
| `current()` · `currentIndex()` | 정면 항목 |

옵션: `radius` `cardW` `cardH` `tilt` `lift` `forward` `pullScale` `dwell` `ticksEvery` `label`.
정면 근처 다섯 장에만 `render` 가 불린다 — 카드가 수백 장이어도 그리는 앞면은 다섯 장이다.

## 입력 정책

| 입력 | 데스크탑(pointer: fine) | 터치(pointer: coarse) |
|---|---|---|
| 스크롤 | 호출부가 `setAngle` 로 돌린다 | **돌리지 않는다** — 엄지 아래에서 판이 계속 움직이면 읽을 수 없다 |
| 가로 끌기 | 돈다, 놓으면 snap | 같음 (`touch-action: pan-y` 라 세로 스크롤은 그대로) |
| ← → | 한 칸 | — |
| 뽑기 버튼 | 있음 | **주 조작**. 44px 이상, 뽑힌 것은 판 바로 아래에 |

## 색

전부 `.cd` 의 `--cd-*` 변수다. 기본값은 K-Heritage 재료이고 쓰는 쪽이 자기 토큰으로 덮는다
(`--cd-face-bg` `--cd-face-fg` `--cd-back-bg` `--cd-line` `--cd-edge` `--cd-mark` `--cd-disc` `--cd-hub` `--cd-meta`).

## 3D 함정

`.cd-world` 의 `rotateX` 는 **음수**여야 정면(+Z)이 화면 아래·가까운 쪽으로 온다. 양수면 아래에서
올려다본 그림이 된다. 뽑힌 카드는 `rotateX(+tilt)` 로 되돌려 카메라를 본다.

## 접근성

호스트는 `role="listbox"` + `tabindex=0`, 카드는 `role="option"` + `aria-selected`, 정면 번호는 `aria-live`.
`prefers-reduced-motion` 이면 스핀·스냅이 즉시 끝난다.
