# FE 화면 검증 표준 — CDP 로 직접 재는 법

타입체크와 빌드가 통과해도 **화면은 틀릴 수 있다.** 색 대비, 테마 전환, 기기 설정에 따른
분기는 컴파일러가 보지 않는다. 실제로 이 레포에서 tsc·build·lint 를 전부 통과한 채로
라이트 모드 타일 제목이 1.07:1 로 안 보였고, 게임 카드는 hover 하면 1.09:1 로 글자가 사라졌다.

**눈으로 봤다는 말 대신 잰 값을 남긴다.** 이 문서는 그 재는 방법이다.

---

## 1. 왜 chrome-devtools MCP 를 기본으로 쓰지 않는가

MCP 는 `~/.cache/chrome-devtools-mcp/chrome-profile` 이라는 **고정 프로필**을 쓴다. 그 프로필로
이미 크롬이 떠 있으면 붙지 못하고, 실패할 때마다 새 크롬을 띄워 락을 다시 잡는 루프에 빠진다.

여기서 **락 파일(`SingletonLock` 등)을 지우거나 크롬을 강제 종료하면 안 된다.** 크롬이 프로필을
비정상 종료로 판단해 "프로필을 여는 동안 문제가 발생했습니다" 알럿을 계속 띄운다 (실제로 겪었다).
막혔을 때의 정답은 락 손대기가 아니라 **아래의 독립 프로필 경로로 갈아타는 것**이다.

MCP 는 탐색적으로 화면을 훑을 때 편하다. 값을 재거나 조건을 바꿔가며 비교할 때는 아래를 쓴다.

---

## 2. 독립 프로필로 헤드리스 크롬 띄우기

사용자 프로필과 MCP 프로필 어느 쪽도 건드리지 않는다.

```bash
mkdir -p /tmp/cdp-profile
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9333 \
  --user-data-dir=/tmp/cdp-profile --no-first-run --no-default-browser-check \
  > /tmp/cdp-chrome.log 2>&1 &

curl -s http://127.0.0.1:9333/json/version    # Browser/Protocol-Version 이 나오면 준비 완료
```

- 탭 생성은 **PUT** 이다. `GET /json/new` 는 거부된다.
  → `fetch('http://127.0.0.1:9333/json/new?<url>', { method: 'PUT' })`
- WebSocket 클라이언트는 `portal-fe/node_modules/ws` 를 그대로 쓴다 (추가 설치 불필요).

---

## 3. 기기(OS) 설정 에뮬레이션

`prefers-color-scheme` 은 OS 설정이라 코드로 못 바꾼다. CDP 로 덮어쓴다.

```js
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: 'dark' }],   // 또는 'light'
});
await send('Page.navigate', { url: 'http://localhost:5199/' });
```

**기기 설정 × 사이트 선택 4조합을 모두 돈다.** 테마 버그는 대각선에서만 드러난다 —
기기 다크 + 사이트 라이트 같은 조합에서 시스템 fallback 규칙이 이겨서 팔레트가 통째로 바뀐 적이 있다
(`:not()` 은 인자의 명세도를 더해서 `:root:not([data-theme='dark'])` 가 (0,3,0) 이 된다).

| 기기 | 사이트 | 기대 |
|---|---|---|
| light | light | 같은 사이트 선택이면 |
| light | dark | 기기와 **무관하게** |
| dark | light | 완전히 같은 값이 나와야 한다 |
| dark | dark | |

값이 조합마다 다르면 어딘가에서 OS 설정이 새고 있다는 뜻이다.

### 자동 다크는 계산값에 안 나온다 — 픽셀을 찍어야 한다

기기 다크의 영향은 **두 층**이다.

| 층 | 재현 | 계산값에 보이나 |
|---|---|---|
| `prefers-color-scheme` (미디어 쿼리) | `Emulation.setEmulatedMedia` | 보인다 |
| 브라우저 자동 다크 (force-dark) | `--enable-features=WebContentsForceDark` 플래그 | **안 보인다** |

자동 다크는 CSS 를 바꾸지 않고 **다 그린 화면의 색을 뒤집는다.** 그래서 `getComputedStyle` 은
`--ko-surface-0: #f9f8f2` 라고 답하는데 실제 화면은 어둡다. 실제로 이 상태가 "4조합 정상"으로
검증을 통과했다 — 픽셀을 찍고서야 잡혔다.

```js
const s = await send('Page.captureScreenshot', { format:'png', clip:{x:700,y:420,width:4,height:4,scale:1} });
// PNG 첫 픽셀을 읽어 실제 칠해진 색을 확인한다
```

**막는 방법은 `only` 다.** `color-scheme: light` 는 "라이트를 지원한다"는 뜻이라 자동 다크가
덧씌워진다. `color-scheme: only light` 는 "이 정경만 지원하니 변환하지 말라"는 선언이라 비켜선다.

> 주의: 플래그로 force-dark 를 켠 채 `prefers-color-scheme: light` 를 에뮬레이션하면 현실에
> 없는 조합이라 결과가 뒤집혀 보인다. 자동 다크는 기기가 다크일 때만 도므로 **dark 조합만** 본다.

---

## 4. 무엇을 재는가

토큰 값과 **대비**를 함께 남긴다. "잘 보인다"는 근거가 아니다.

```js
const cs = getComputedStyle(document.documentElement);
cs.getPropertyValue('--ko-surface-0');   // 바탕
cs.getPropertyValue('--ko-text-primary');
cs.colorScheme;                          // 정경을 따라가야 한다
```

요소 단위로는 **실제로 겹치는 두 색**을 잡아야 한다. 부모 배경을 안 보고 글자색만 재면
"토큰은 맞는데 안 보이는" 경우를 놓친다.

```js
getComputedStyle(label).color            // 글자
getComputedStyle(card).backgroundColor   // 그 글자가 얹힌 면
```

### 색 파싱 — 여기서 한 번 속는다

`getComputedStyle` 이 돌려주는 형식이 하나가 아니다. `rgb(29, 29, 31)` 은 0~255 정수지만,
`color-mix()` 를 쓴 값은 `color(srgb 0.976 0.973 0.949 / 0.62)` 로 **0~1 스케일 + 알파**로 온다.
숫자만 훑어 255 로 나누면 밝은 색이 거의 검정으로 계산된다 — 실제로 멀쩡한 값을 1.24:1 로
잘못 읽고 CSS 버그로 오인했다.

```js
const parse = (c) => {
  const n = (c.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number);
  const srgb = c.startsWith('color(');            // 0~1 스케일
  const [r, g, b, a] = srgb ? n : [n[0]/255, n[1]/255, n[2]/255, n[3]];
  return [r, g, b, a === undefined ? 1 : a];
};
// 반투명 글자는 배경 위에 합성한 뒤 재야 한다
const over = (fg, bg) => { const f = parse(fg), b = parse(bg);
  return [0,1,2].map(i => f[i]*f[3] + b[i]*(1-f[3])); };
```

**대비가 이상하게 낮게 나오면 CSS 를 고치기 전에 원색부터 찍어본다.** 계산기가 틀린 경우가 있다.

- 본문 **4.5:1**, 큰 글자·UI 요소 **3:1** 이 하한이다 (WCAG AA).
- **hover·focus 등 상태도 잰다.** 기본 상태만 재면 hover 에서 바탕만 바뀌어 글자가 사라지는
  종류의 버그가 그대로 남는다.
- 화면에 없는 요소(API 미연결로 목록이 빈 경우 등)는 **같은 클래스의 요소를 DOM 에 넣어** 재도 된다.
  검증 대상이 데이터가 아니라 CSS 캐스케이드라면 그걸로 충분하다.

---

## 5. 캐스케이드가 의심되면 빌드 산출물을 본다

명세도가 같으면 **나중에 실린 쪽이 이긴다.** 그 순서는 번들러가 정하므로 소스가 아니라
산출물에서 확인한다.

```bash
CSS=$(ls -S portal-fe/dist/assets/index-*.css | head -1)
grep -o "prefers-color-scheme:light" "$CSS"     # 위치 비교로 순서 확인
```

---

## 6. 끝나면 정리한다

```bash
pkill -f "user-data-dir=/tmp/cdp-profile"
rm -rf /tmp/cdp-profile
```

이 프로필은 임시라 지워도 잃을 게 없다. **MCP 프로필이나 사용자 크롬은 이 절차에서 손대지 않는다.**

---

## 관련

- 디자인 토큰·정경 정의 → `DESIGN.md` §12, `docs/design/k-heritage.html`
- 디자인 가드레일 → `docs/conventions/frontend-design.md`
