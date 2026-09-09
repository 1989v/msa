/** 목차 한 줄. `level` 은 h2/h3 만 — h4 부터는 접힌 목록에서 층이 너무 깊어진다. */
export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * 렌더된 본문의 제목에 고유 id 와 링크 앵커를 달고, 그 결과에서 목차를 뽑는다.
 *
 * **id 를 만드는 곳과 목차를 읽는 곳이 한 곳이다.** 마크다운을 따로 한 번 더 훑어
 * 목차를 만들면 두 벌의 id 규칙이 생기고, 어긋나도 화면에는 목차가 멀쩡히 보인다 —
 * 눌러 봐야 안 맞는 걸 안다. 여기서는 붙인 id 를 그대로 담아 돌려주므로 어긋날 수 없다.
 *
 * 입력은 sanitize 를 지난 HTML 이고 (`renderMarkdown`), 여기서 만드는 것은 `<a>` 하나뿐이며
 * 글자는 전부 DOM API 로 넣는다. 문자열 조립이 없으므로 raw 가 다시 섞이지 않는다.
 */
export function decorateHeadings(html: string): { html: string; toc: TocEntry[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const used = new Set<string>();
  const toc: TocEntry[] = [];

  doc.body.querySelectorAll('h2, h3').forEach((heading, index) => {
    // 앵커를 붙이기 전에 읽는다 — 붙인 뒤면 제목 글자에 '#' 이 섞인다
    const text = heading.textContent?.trim() ?? '';
    const id = uniqueId(heading.id || slugify(text) || `section-${index + 1}`, used);
    heading.id = id;

    const anchor = doc.createElement('a');
    anchor.className = 'blog-anchor';
    anchor.href = `#${encodeURIComponent(id)}`;
    anchor.setAttribute('aria-label', `${text} 절 링크 복사`);
    anchor.textContent = '#';
    heading.appendChild(anchor);

    toc.push({ id, text, level: heading.tagName === 'H2' ? 2 : 3 });
  });

  return { html: doc.body.innerHTML, toc };
}

/**
 * 제목 글자 → 주소에 쓸 조각.
 *
 * **한글을 로마자로 옮기지 않는다.** 옮김 규칙은 사람마다 달라 주소가 예측 불가능해지고,
 * 나중에 규칙을 바꾸면 이미 공유된 절 링크가 죽는다 (글 슬러그와 같은 판단,
 * `BlogPost.resolveSlug`). 글자를 그대로 두면 규칙이 바뀔 일 자체가 없다.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 같은 제목이 두 번 나오면 뒤엣것에 번호를 붙인다 — 안 그러면 둘 다 첫 번째로 간다. */
function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}
