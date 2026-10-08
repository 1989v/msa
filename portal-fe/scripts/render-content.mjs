// 레포 안 마크다운 원본을 빌드 때 HTML 로 굽는다. mermaid 펜스는 fencesvg 로 SVG 가 된다.
//
// 실행: node scripts/render-content.mjs
//   src/content/search-architecture.md → src/pages/tech/generated/search-architecture.json
//   생성물은 커밋하지 않는다(.gitignore). 그래서 build·dev·Dockerfile·CI·커밋 훅이 tsc 보다 먼저 이걸 돌린다.
//
// 아래 검사는 sanitizer 가 아니라 출력 계약 트립와이어다 — 원본은 레포에 커밋된 md 뿐이고,
// 어기면 빌드를 세운다. 이미지 빌드가 실패하면 Argo 가 직전 이미지를 유지한다.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderDiagram } from 'fencesvg';
import { Marked } from 'marked';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'src/content/search-architecture.md');
const OUTPUT = resolve(ROOT, 'src/pages/tech/generated/search-architecture.json');
const ID_PREFIX = 'ts-';

const FENCE_RE = /^```mermaid[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm;
const placeholder = (i) => `@@fencesvg-${i}@@`;

const FORBIDDEN_TAG_RE =
  /<(script|style|use|foreignObject|iframe|object|embed|base|meta|link|form)\b|srcdoc\s*=/i;
const EVENT_ATTR_RE = /<[^>]*[\s/"']on[a-z]+\s*=/i;
const URL_ATTR_RE = /(?:^|[\s"'/])(xlink:href|href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi;
const BANNED = [
  ['클러스터 내부 주소', /svc\.cluster\.local/i],
  ['레지스트리 주소', /\.ocir\.io/i],
  ['IPv4 주소', /\b\d{1,3}(\.\d{1,3}){3}\b/],
  ['메일 주소', /[\w.+-]+@[\w-]+(\.[\w-]+)+/],
  ['자격 문자열', /(api[_-]?key|secret|password|token)\s*[:=]/i],
  ['회사 이름', /myrealtrip/i],
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 태그 제거 · 엔터티 해제 · 백틱 문자 제외 */
function plainText(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (ENTITIES[e]) return ENTITIES[e];
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return m;
    })
    .replace(/`/g, '')
    .trim();
}

/** heading·표 행 공용 slug — 소문자, 공백은 `-`, 영숫자·한글·`-` 만 남긴다(한글 보존) */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '');
}

function fail(reason) {
  throw new Error(`[render-content] ${reason}`);
}

/**
 * @param {string} markdown
 * @param {{ idPrefix: string, gitSha?: string }} opts  gitSha 는 main 이 JSON 에 찍는다(본문에는 안 쓴다)
 * @returns {{ html: string, headings: Array<{ level: number, id: string, text: string }>, warnings: string[] }}
 */
export function renderContent(markdown, { idPrefix }) {
  // ① 펜스마다 그림을 그리고, 펜스 자리는 자리표시 문단으로 바꿔 marked 가 SVG 를 건드리지 않게 한다.
  const figures = [];
  const warnings = [];
  const withPlaceholders = markdown.replace(FENCE_RE, (_m, src) => {
    const i = figures.length;
    // 기본 idPrefix(d1)를 쓰면 그림마다 마커 id 가 겹친다.
    const { svg, caption, warnings: w } = renderDiagram(src, { idPrefix: `${idPrefix}d${i}` });
    for (const msg of w) warnings.push(`펜스 ${i}: ${msg}`);
    if (svg === null) warnings.push(`펜스 ${i}: SVG 를 만들지 못했다`);
    // fencesvg 가 감싸는 가로 스크롤 div 는 벗긴다 — 가로 스크롤은 페이지 CSS 가 figure 에 준다.
    const bare = svg?.match(/<svg\b[\s\S]*<\/svg>/)?.[0] ?? '';
    figures.push(`<figure class="fs-figure">${bare}<figcaption>${escapeHtml(caption ?? '')}</figcaption></figure>`);
    return `\n\n${placeholder(i)}\n\n`;
  });
  if (warnings.length > 0) fail(`① 그림 경고 ${warnings.length}건 — ${warnings.join(' / ')}`);

  const headings = [];
  const usedIds = new Set();
  const uniqueId = (slug) => {
    let id = idPrefix + slug;
    for (let n = 2; usedIds.has(id); n++) id = `${idPrefix}${slug}-${n}`;
    usedIds.add(id);
    return id;
  };
  let inTechTable = false; // `## 4.` 아래 표 본문 행에만 id 를 단다

  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const text = plainText(inner);
        if (depth <= 2) inTechTable = depth === 2 && /^4\./.test(text);
        const id = uniqueId(slugify(text));
        headings.push({ level: depth, id, text });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      table(token) {
        const head = this.tablerow({ text: token.header.map((cell) => this.tablecell(cell)).join('') });
        const body = token.rows
          .map((row) => this.tablerow({ text: row.map((cell) => this.tablecell(cell)).join('') }))
          .join('');
        return `<table class="kh-table">\n<thead>\n${head}</thead>\n${body ? `<tbody>${body}</tbody>` : ''}</table>\n`;
      },
      tablerow({ text }) {
        const first = text.match(/^<td\b[^>]*>([\s\S]*?)<\/td>/);
        if (!inTechTable || !first) return `<tr>\n${text}</tr>\n`;
        return `<tr id="${uniqueId(slugify(plainText(first[1])))}">\n${text}</tr>\n`;
      },
      tablecell({ tokens, header, align }) {
        const inner = this.parser.parseInline(tokens);
        const alignAttr = align ? ` align="${align}"` : '';
        return header ? `<th scope="col"${alignAttr}>${inner}</th>\n` : `<td${alignAttr}>${inner}</td>\n`;
      },
      link({ href, title, tokens }) {
        if (!href.startsWith('#')) return false;
        // 기본 renderer 는 href 를 encodeURI 해 한글 slug 가 %EA… 로 바뀌고 id 와 어긋난다.
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="#${escapeHtml(idPrefix + href.slice(1))}"${titleAttr}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });

  let html = marked.parse(withPlaceholders, { async: false });
  html = html.replace(/<p>@@fencesvg-(\d+)@@<\/p>/g, (_m, i) => figures[Number(i)]);
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  check(html, figures.length);
  return { html, headings, warnings };
}

function check(html, fenceCount) {
  // ②
  const imgCount = (html.match(/<svg\b[^>]*\brole="img"/g) ?? []).length;
  if (imgCount !== fenceCount) fail(`② 그림 수 ${imgCount} ≠ 펜스 수 ${fenceCount}`);
  if (html.includes('language-mermaid')) fail('② 그려지지 않은 mermaid 코드 블록이 남았다(펜스 형식 확인)');
  // ③
  const tag = html.match(FORBIDDEN_TAG_RE);
  if (tag) fail(`③ 금지 태그·속성: ${tag[0]}`);
  // ④
  const ev = html.match(EVENT_ATTR_RE);
  if (ev) fail(`④ 이벤트 속성: ${ev[0].slice(0, 80)}`);
  // ⑤ 같은 출처 경로·앵커·https 만. `//host` 는 다른 출처라 막는다.
  for (const m of html.matchAll(URL_ATTR_RE)) {
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    const ok = value.startsWith('#') || value.startsWith('https://') || (value.startsWith('/') && !value.startsWith('//'));
    if (!ok) fail(`⑤ 허용되지 않은 주소: ${m[1]}="${value}"`);
  }
  // ⑥
  if (html.includes('<!--')) fail('⑥ HTML 주석이 남았다');
  // ⑦
  for (const [name, re] of BANNED) {
    const hit = html.match(re);
    if (hit) fail(`⑦ 금칙 패턴(${name}): ${hit[0]}`);
  }
  // ⑧
  for (const svg of html.match(/<svg\b[\s\S]*?<\/svg>/g) ?? []) {
    if (/\n[ \t]*\n/.test(svg)) fail('⑧ SVG 안에 빈 줄이 있다 — HTML 블록이 끊긴다');
  }
  // ⑨
  const ids = [...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`⑨ id 중복: ${id}`);
    seen.add(id);
  }
  for (const m of html.matchAll(/href="#([^"]*)"/g)) {
    if (!seen.has(m[1])) fail(`⑨ 죽은 앵커: #${m[1]} 에 대응하는 id 가 없다`);
  }
}

async function main() {
  const markdown = await readFile(SOURCE, 'utf8');
  const updated = markdown.match(/문서 갱신일[^\n]*?(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!updated) fail(`「문서 갱신일」 줄(YYYY-MM-DD)을 찾지 못했다: ${SOURCE}`);
  const { html, headings } = renderContent(markdown, { idPrefix: ID_PREFIX });
  const sourceHash = createHash('sha256').update(markdown).digest('hex').slice(0, 12);
  const gitSha = process.env.GIT_SHA ?? 'dev';
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify({ html, headings, updated, sourceHash, gitSha }, null, 2)}\n`);
  console.log(`[render-content] ${OUTPUT} — 그림 ${(html.match(/<figure /g) ?? []).length}장, heading ${headings.length}개`);
}

// 직접 실행일 때만 돈다 — 테스트는 import 만으로 파일을 쓰지 않는다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
