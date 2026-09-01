---
name: blog-diagram
description: 블로그 글에 넣을 다이어그램을 그린다. 판단은 내장 artifact-diagramming, 삽입 규칙은 docs/conventions/blog-diagram.md 를 따른다. "블로그에 그림 넣어줘", "이 글에 다이어그램", "구조도 그려줘" 같은 요청에도 반응.
argument-hint: [초안 경로 | 설명할 대상]
---

# 블로그 다이어그램

`blog.1989v.com` 글 본문에 들어갈 그림을 그린다.

## 시작할 때 반드시

1. **`artifact-diagramming` 스킬을 먼저 로드한다** — 무엇을 그릴지·그릴 값어치가 있는지의
   단일 원본이다. 이 스킬은 그 내용을 복사해 두지 않는다.
2. `docs/conventions/blog-diagram.md` 를 읽는다 — 이 블로그의 렌더 경로가 무엇을 지우는지.

## 순서

1. **그릴지 정한다.** 한 문장이 더 빠르면 문장을 쓴다. 그리기로 했으면 그림이 답할 질문을
   한 줄로 적는다 — 그게 `aria-label` 과 캡션이 된다.
2. **그린다.** 아래 골격에서 시작한다.
3. **캡션을 SVG 블록 밖 마크다운 한 줄로 쓴다.** 크롤러가 읽는 건 이쪽이다.
4. **`scripts/lint-blog-post.py <초안>` 을 돌린다.** 통과해야 끝이다.
5. 토큰 색을 썼으면 두 테마에서 잰다 (`docs/standards/fe-visual-verification.md`).

## 골격

```markdown
<svg viewBox="0 0 480 110" role="img" aria-label="주문은 결제 승인 뒤에만 재고를 예약한다">
  <defs>
    <marker id="d1-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
      <polygon points="0,0 8,4 0,8" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="1" y="30" width="120" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="61" y="52" text-anchor="middle" fill="currentColor" font-size="13">주문</text>
  <text x="61" y="68" text-anchor="middle" fill="currentColor" font-size="11" opacity="0.7">PENDING</text>
  <line x1="125" y1="53" x2="175" y2="53" stroke="currentColor" stroke-width="1.5" marker-end="url(#d1-arrow)"/>
  <text x="150" y="44" text-anchor="middle" fill="currentColor" font-size="11">결제 승인</text>
  <rect x="179" y="30" width="120" height="46" rx="6" fill="none" style="stroke:var(--ko-accent-primary)" stroke-width="1.5"/>
  <text x="239" y="57" text-anchor="middle" style="fill:var(--ko-accent-primary)" font-size="13">재고 예약</text>
</svg>

그림: 재고는 결제 승인 뒤에 잡는다. 승인 전에 잡으면 미결제 주문이 재고를 물고 있는다.
```

## 이 블로그에서 안 되는 것 (실측)

| 안 됨 | 대신 |
|---|---|
| `<style>` — SVG 안 CSS | presentation 속성 · `style` 속성 |
| `<use href>` — 도형 재사용 | 반복 모양은 그대로 다시 그린다 |
| `<figure>` / `<figcaption>` | 캡션은 블록 밖 마크다운 한 줄 (크롤러 사본이 raw HTML 을 버린다) |
| hex 직접 입력 | `currentColor` 기본 + 강조 하나만 `var(--ko-*)` |
| 그림에만 있는 정보 | 캡션이나 본문에 글로도 남긴다 |
| SVG 안의 **빈 줄** | 빈 줄 없이 붙여 쓴다 — 여기서 HTML 블록이 끊겨 뒷부분이 문단으로 파싱되고 속성이 날아간다 |

한 글에 그림이 둘 이상이면 `id` 에 `d1-` · `d2-` 접두사를 붙인다. 안 붙이면 뒤 그림의
화살촉이 앞 그림 것을 가리킨다.
