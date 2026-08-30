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

## 4.5 잰 값을 믿기 전에 — 무엇을 재고 있는지부터 확인한다

**틀린 측정은 안 잰 것보다 나쁘다.** PASS 가 찍히면 그 자리를 다시 안 보기 때문이다.
2026-08-20 하루에 아래 셋을 다 밟았고, 셋 다 화면은 멀쩡했는데 숫자만 거짓이었다.

### 앱이 떴는지 먼저 본다

`vite` 를 레포 루트에서 띄우면(`npx --prefix` 는 cwd 를 안 바꾼다) 404 가 나고 크롬은
**자기 오류 페이지**를 그린다. 거기에 프로브를 심으면 UA 기본색(`rgb(32,33,36)` 바탕,
`rgb(138,180,248)` 링크)을 재고 "PASS" 가 나온다. 이 세 색이 보이면 앱이 아니라 오류 페이지다.

```js
if (!document.querySelector('.place-page')) return JSON.stringify({error: '앱이 로드되지 않음'});
```

### 재는 번들이 방금 구운 그것인지 본다

`vite preview` 는 **`dist/` 스냅샷**을 서빙한다. `public/` 아래 산출물(게임 번들 등)은 FE 를
빌드할 때 복사된 것이라, 게임을 아무리 다시 구워도 화면은 **몇 시간 전 번들**이다.
`Network.setCacheDisabled` 를 켜도 소용없다 — 서버가 옛것을 내주고 있기 때문이다.

2026-08-30 이것 때문에 같은 수정을 두 번 했다. HUD 위치를 고치고 다시 굽고 스크린샷을
찍었는데 안 움직여서 "코드가 안 먹는다"고 판단했고, 실제로는 프리뷰가 6시간 전 번들을
내주고 있었다.

**이번에 새로 넣은 심볼이 응답 안에 있는지로 확인한다.** 해시만 보면 index.html 은
갱신됐는데 로더가 옛것인 경우를 놓친다.

```js
// 로드된 번들이 정말 새것인가 — 이번에 추가한 이름으로 확인한다
Object.keys(window.Module || {}).filter(k => k.startsWith('kgd'))   // kgdSafeTop 이 있어야 새 빌드
document.querySelector('script[src*=loader]').src                    // 해시도 같이 남긴다
```

없으면 그 측정은 버린다. 프리뷰를 다시 띄우거나, 배포한 뒤 운영에서 잰다.

### 배경이 투명하면 검정으로 계산된다

`body` 에 `position: fixed` 로 프로브를 띄우면 배경이 `rgba(0,0,0,0)` 이다. 그걸 그대로
대비 계산에 넣으면 **검정 위에서 잰 값**이 나와 멀쩡한 8.8:1 이 2.24:1 로 읽힌다.

프로브는 **실제로 들어갈 자리에 심고**, 배경은 조상으로 올라가 실제로 칠해진 색을 찾은 뒤
반투명이면 그 위에 합성한다. `.place-chip.active` 처럼 알파가 있는 배경이 흔하다.

```js
const painted = (el) => { const stack = [];
  for (let n = el; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (!c || c === 'rgba(0, 0, 0, 0)') continue;
    stack.push(c);
    if (alphaOf(c) >= 0.999) break;      // 불투명한 층을 만나면 멈춘다
  }
  return stack.reverse(); };             // 아래에서 위로 합성
```

### 겹침은 사각형 교차로 본다

x 축만 비교하면 **세로로 쌓인 레이아웃이 전부 "겹침"** 으로 나온다. 좁은 화면에서
목록·지도·정보가 순서대로 쌓이면 left/right 는 당연히 겹친다.

```js
d.left < m.right && d.right > m.left && d.top < m.bottom && d.bottom > m.top
```

---

## 5. 캐스케이드가 의심되면 빌드 산출물을 본다

명세도가 같으면 **나중에 실린 쪽이 이긴다.** 그 순서는 번들러가 정하므로 소스가 아니라
산출물에서 확인한다.

```bash
CSS=$(ls -S portal-fe/dist/assets/index-*.css | head -1)
grep -o "prefers-color-scheme:light" "$CSS"     # 위치 비교로 순서 확인
```

---

## 6. 끝나면 정리한다 — **스크립트로만** (2026-08-25 개정)

```bash
export CLAUDE_SCRATCHPAD=<이 세션 스크래치패드>   # 안 주면 남의 세션을 집는다 (아래 경고)
scripts/cdp-chrome.sh start <이름>        # 띄운다 (포트를 돌려준다. 같은 이름이면 같은 포트)
scripts/cdp-chrome.sh start <이름> --gl   # WebGL 켜서 — 유니티 게임용
scripts/cdp-chrome.sh list                # 살아 있는 것 + 남의 것 표시
scripts/cdp-chrome.sh clean               # 이 세션 것 전부 종료 + 프로필 삭제
```

> [!caution] **`--gl` 로 띄운 크롬은 재고 나면 바로 끈다.**
> 헤드리스에는 하드웨어 GL 이 없어 `--use-angle=swiftshader` 로 3D 를 **CPU 로** 그린다.
> 2026-08-30 유니티 게임을 띄워 둔 채로 두었더니 렌더러 하나가 **759% CPU** 를 먹었고,
> 사용자가 장비 발열로 알아챘다. 스크린샷 한 장마다 `start` → 재기 → `stop` 이다.
>
> 같은 날, 그 크롬을 **스크립트를 우회해** 직접 띄운 것이 문제를 키웠다(당시 런처가
> GL 플래그를 못 받았다 — 지금은 `--gl` 로 받는다). 우회해서 띄우면 `stop` 이 그것을
> 자기 것으로 못 알아보고 거절해, **끌 수단이 없어진다.**
> `CLAUDE_SCRATCHPAD` 를 안 주면 스크립트가 「가장 최근 스크래치패드」를 추측하는데,
> 여러 세션이 돌면 그게 내 것이 아니라 같은 이유로 정리가 막힌다.

> [!warning] **`pkill` 을 손으로 치지 마라.**
> 이 절에 원래 `pkill -f "user-data-dir=/tmp/cdp-profile"` 이 적혀 있었는데, 그 문장이
> 있는데도 **한 세션이 프로필 9개 · 크롬 67 프로세스 · 4.5GB** 를 쌓았다. 그리고 정리하다
> 범위를 잘못 잡아 **작업 중이던 크롬까지 죽였고**, 이어서 프로세스를 잘못 세어
> "사용자 크롬은 살아 있다" 고 오판해 진단이 한 바퀴 헛돌았다.
> 문서에만 있는 절차는 지켜지지 않는다 — 그래서 스크립트로 내렸다.

`scripts/cdp-chrome.sh` 가 강제하는 것:

| | |
|---|---|
| 프로필 위치 | **세션 스크래치패드 아래 `cdp/<이름>`** 고정 — 남의 것과 섞이지 않는다 |
| 포트 | 이름에서 결정론적으로(9400~9499). 같은 이름이면 같은 포트라 **중복 기동이 안 된다** |
| 포트 충돌 | 남이 쓰고 있으면 **비켜 간다** — 남의 크롬을 죽이지 않는다 |
| `stop`/`clean` 범위 | 이름 검증(`/`·`..` 금지) + realpath 재확인 — **자기 세션 밖은 물리적으로 못 죽인다** |
| `--disable-gpu` | 붙이지 않는다 (SwiftShader 로 떨어져 fps 10~30) |

**사용자 크롬과 MCP 프로필은 이 스크립트가 경로로 막는다.** 그래도 막혔을 때의 정답은
여전히 §1 그대로다 — 락을 지우지 말고 독립 프로필로 갈아탄다.

### 세션이 끝날 때

작업이 끝나면 **반드시 `clean` 을 부른다.** 남겨두면 다음 사람이 크롬을 못 띄운다 —
크롬은 프로필당 하나만 뜨고, 쌓인 헤드리스가 시스템 자원을 먹는다.

---

## 관련

- 디자인 토큰·정경 정의 → `DESIGN.md` §12, `docs/design/k-heritage.html`
- 디자인 가드레일 → `docs/conventions/frontend-design.md`
