# fencesvg — 설계

마크다운 코드 펜스에 쓴 다이어그램을, 그 사이트의 디자인 톤으로 그려 내는 라이브러리.
별도 오픈소스 레포(`1989v/fencesvg`, MIT)로 만든다. 첫 소비자는 `blog.1989v.com` 이다.

## 1. 문제

다이어그램의 어려운 부분은 그리기가 아니라 **넣기**다. 2026-09-01 블로그에 그림을 넣으려다
같은 SVG 가 네 지점에서 죽는 것을 실측했다.

| 지점 | 무엇이 일어났나 |
|---|---|
| sanitizer | `<style>` 과 `<use href>` 가 제거된다. SVG 안에 CSS 를 못 두고 도형 재사용도 안 된다 |
| 문체 lint | SVG 한 줄이 **596자짜리 문장**으로 잡혀 글이 통과하지 못한다 |
| 서버 렌더 | raw HTML 을 이스케이프하면 `&lt;svg viewBox=…` 가 색인되는 본문 텍스트로 샌다 |
| CommonMark | **SVG 안의 빈 줄이 HTML 블록을 끊는다.** 뒷부분이 문단으로 파싱되며 속성이 sanitize 에 날아간다 |

이건 이 블로그의 특이사항이 아니다. 마크다운 파서 + sanitizer + 서버 렌더 조합이면 같은
자리에서 걸린다 (추정 — 다른 사이트에서 재보지 않았다). 기존 도구는 "예쁜 SVG"를 내주지만
**넣을 수 있는 SVG 인지는 모른다.**

두 번째 문제는 톤이다. 다이어그램이 사이트와 다른 색·활자로 그려지면 본문에서 튄다.
기존 도구는 테마를 설정으로 받는데, 그러면 사이트 토큰과 원본이 둘로 갈린다.

## 2. 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 입력 | 마크다운 코드 펜스. mermaid `flowchart` 문법 | 이미 널리 쓰이는 문법이라 입력 설계에 시간을 안 쓴다 |
| 생성 시점 | **런타임** — 독자가 글을 열 때 | 저자는 아무 명령도 실행하지 않는다. 원고는 끝까지 편집 가능한 펜스로 남는다 |
| 렌더러 | **자체** (파서·레이아웃·작도 전부) | mermaid 출력은 `<style>` 과 클래스로 칠해 sanitize 에 지워진다. 후처리보다 직접 그리는 쪽이 짧다 |
| 레이아웃 | 자체 층별 배치 (의존성 없음) | 번들이 임계 경로에 있다. v1 이 flowchart 하나면 dagre(gzip 약 30KB)는 과하다 |
| 색 | `currentColor` + `var(--토큰)` | 생성 시점이 아니라 **칠하는 시점에** 풀리므로 설정 파일이 필요 없다. 테마 토글도 따라간다 |
| 글자 폭 | 내장 근사 테이블 | 브라우저 측정에 기대면 CSR 전용이 되고 하이드레이션에서 화면이 튄다 |
| 어댑터 | **출력 프로파일** (검사기 아님) | 우리가 만드는 SVG 라 살아남지 못할 것을 애초에 안 내보내면 된다 |

## 3. 비목표 (v1)

- flowchart 외의 다이어그램 타입 (sequence · state · ER · gantt)
- 글에서 색을 직접 지정하는 문법 — 열어 주면 사이트 톤에 맞춘다는 전제가 깨진다
- 애니메이션 · 상호작용 · 클릭 핸들러
- 이미 쓰인 문서를 검사하는 `check` 명령
- 헤드리스 브라우저로 사이트 토큰을 추출하는 `init` — 런타임 생성이라 색을 알 필요가 없다

## 4. 구조

네 단계 순수 함수다. 브라우저 API · 파일시스템 · 네트워크를 쓰지 않아 **어디서 돌려도 같은
문자열**이 나온다 (CSR · SSR · SSG · RSC).

```
```mermaid 펜스
    ↓  parse     문법 → 그래프 { 노드, 간선, 라벨, 방향, 캡션 }
    ↓  layout    랭크 배치 → 층 내 순서(barycenter) → 좌표. 폭은 근사 테이블
    ↓  draw      좌표 → SVG 요소. 색은 currentColor / var(--토큰)
    ↓  profile   발행 경로가 지우는 것을 애초에 안 내보냄
{ svg, caption, warnings }
```

각 단계가 앞 단계의 산출물만 받으므로 따로 테스트된다. 목표 크기는 min+gzip **10KB 안쪽**
(추정 — 구현 후 실측해 README 에 적는다).

## 5. API

핵심은 함수 둘이다.

```ts
// 펜스 하나 → SVG
renderDiagram(source: string, opts?: Options): Result

// 마크다운 문서의 모든 펜스를 SVG 로 치환한 마크다운을 돌려준다
inlineDiagrams(markdown: string, opts?: Options): string

type Result = { svg: string | null; caption: string | null; warnings: string[] };

type Options = {
  profile?: 'sanitized' | 'permissive';  // 기본 'sanitized'
  accent?: string;                       // 강조 요소의 색. 기본 'currentColor'
  idPrefix?: string;                     // renderDiagram 을 직접 부를 때만 필요
};
```

`inlineDiagrams` 는 펜스를 **SVG 한 덩어리 + 그 아래 캡션 줄**로 치환한다. 캡션을 따로
넣는 일을 소비자에게 맡기지 않는다 — 맡기면 잊히고, 잊히면 크롤러가 그림을 못 읽는다.

`idPrefix` 도 `inlineDiagrams` 가 문서 안에서 자동으로 매긴다(`d1-` · `d2-` …).
`renderDiagram` 을 직접 부르는 쪽만 직접 준다.

소비자는 마크다운 파이프라인 앞에 한 줄을 넣는다. DOM 조작도, 플레이스홀더도, 마운트 후
렌더도 없다.

```ts
const withDiagrams = inlineDiagrams(source);
const raw = marked.parse(withDiagrams, { async: false, gfm: true });
return DOMPurify.sanitize(raw, { FORBID_TAGS: ['style', 'iframe', 'form', 'input'] });
```

번들은 동적 import 로 가른다. 본문에 펜스가 없으면 로드하지 않는다.

## 6. 문법 범위 (v1)

mermaid `flowchart` 의 부분집합.

```
flowchart LR                    방향 4종 (LR RL TD BT)
  A[주문] --> B{결제}            상자 3종: [] 사각  () 둥근  {} 마름모
  B -->|승인| C[재고 예약]        간선 라벨
  B -.->|거절| D[취소]           선 2종: --> 실선  -.-> 점선
  class C emphasis               강조 1종 → Options.accent
```

못 읽는 문법을 만나면 **펜스를 원래 코드블록으로 남기고 경고**한다. 그림이 사라지는 것보다
코드가 보이는 편이 낫다.

## 7. 캡션과 접근성

펜스 첫 줄의 `%% caption:` 주석을 캡션으로 쓴다. mermaid 주석 문법이라 다른 도구에서도
깨지지 않는다.

```
%% caption: 주문은 결제 승인 뒤에 재고를 잡는다
```

한 줄이 세 곳에 쓰인다.

1. `<svg role="img" aria-label>` — 화면을 못 보는 사람
2. 그림 아래 **마크다운 캡션 줄** — 크롤러와 JS 를 실행하지 않는 수집기
3. 파싱 실패 시 대체 텍스트

캡션이 없으면 경고한다. **그림에만 있는 정보는 없는 정보**라는 규칙을 라이브러리가
강제하는 자리다.

## 8. 프로파일

`sanitized` 프로파일이 지키는 것 — 전부 2026-09-01 실측에서 나온 목록이다.

| 규칙 | 안 지키면 |
|---|---|
| `<style>` 을 안 낸다 | sanitize 가 지워 그림이 무채색이 된다 |
| `<use>` 를 안 낸다 | 지워져 도형이 빈다. 반복 모양은 그대로 다시 그린다 |
| `<script>` · `<foreignObject>` 를 안 낸다 | 지워진다 |
| SVG 안에 빈 줄을 안 낸다 | HTML 블록이 끊겨 뒷부분 속성이 날아간다 |
| 요소를 한 줄에 하나씩 | 같은 줄에 붙은 것은 블록이 끊길 때 함께 사라진다 |
| 모든 `id` 에 접두어 | 한 문서의 두 번째 그림이 첫 그림의 화살촉을 가리킨다 |
| 캡션을 SVG **밖** 마크다운 줄로 | `<figcaption>` 은 raw HTML 이라 크롤러 사본에서 함께 버려진다 |

`permissive` 는 이 제약이 없는 면(자기 HTML 을 그대로 렌더하는 곳)을 위한 것이다.

## 9. 오류 처리

**라이브러리는 던지지 않는다.** 글 하나의 오타가 페이지를 흰 화면으로 만들면 안 된다.
항상 `{ svg, caption, warnings }` 를 돌려주고, 실패하면 `svg` 가 `null` 이라 호출자가
원래 코드블록을 렌더한다.

## 10. 테스트

| 종류 | 무엇 |
|---|---|
| 스냅샷 | 문법 케이스별 SVG 문자열 고정. 레이아웃 회귀가 바로 잡힌다 |
| 불변식 | 프로파일 금지 목록이 출력에 없다 — `<style>` · `<use>` · `<script>` · `foreignObject` · 빈 줄 · 중복 id |
| 왕복 | 생성한 SVG 를 실제 `marked` + DOMPurify 에 통과시켜 요소 수가 보존되는지 |
| 결정성 | 같은 입력이 항상 같은 문자열. Node 와 브라우저에서 같은 값 |

왕복 테스트가 이 프로젝트의 핵심 게이트다. 다른 것이 다 통과해도 이게 깨지면 그림이
화면에서 사라진다.

## 11. 첫 소비자 연결

`portal-fe/src/pages/blog/markdown.ts` 의 `renderMarkdown` 에 한 줄. 기존 컨벤션
(`docs/conventions/blog-diagram.md`)은 손으로 SVG 를 쓰는 규칙인데, 이 라이브러리가
붙으면 **그 규칙을 사람이 지키는 대신 라이브러리가 지킨다.** 컨벤션 문서는 남긴다 —
손으로 그려야 할 때의 규칙이자 프로파일의 근거이기 때문이다.

## 12. 이후

| 버전 | 무엇 | 조건 |
|---|---|---|
| v2 | `check` — 이미 쓰인 문서의 SVG 가 그 사이트를 통과하는지 | 손으로 그린 그림이나 다른 도구 산출물이 실제로 쌓였을 때 |
| v2 | remark 플러그인 · CLI 어댑터 | 런타임이 아닌 소비자가 나타났을 때 |
| v3 | sequence · state 타입 | flowchart 로 안 되는 글이 나왔을 때 |
| — | 헤드리스 토큰 추출 | 런타임에서 CSS 가 색을 풀어 주므로 필요 없다. SSR 전용 소비자가 생기면 재검토 |

각 항목은 **조건이 충족되기 전에는 만들지 않는다.** 어댑터가 하나뿐인 상태에서 추상화하면
사용자가 하나뿐인 인터페이스가 된다.

## 관련

- `docs/conventions/blog-diagram.md` — 손으로 그릴 때의 규칙, 프로파일의 근거
- `docs/adr/ADR-0072-blog-platform.md` §6 — 글 상세 HTML 과 크롤러 사본
- `docs/standards/fe-visual-verification.md` — 토큰·대비 측정 방법
