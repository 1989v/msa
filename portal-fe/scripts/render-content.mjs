// 레포 안 마크다운 원본을 빌드 때 HTML 로 굽는다. mermaid 펜스는 fencesvg 로 SVG 가 된다.
//
// 실행: node scripts/render-content.mjs
//   src/content/search-architecture.md → src/pages/tech/generated/search-architecture.json
//   src/content/guides/{slug}.md       → src/pages/place/generated/guides/{slug}.json (편집 페이지 — 본문·머리말·parts)
//   생성물은 커밋하지 않는다(.gitignore). 그래서 build·dev·Dockerfile·CI·커밋 훅이 tsc 보다 먼저 이걸 돌린다.
//   API 는 부르지 않는다 — 편집 페이지의 관광지 카드는 프리렌더(prerender-seo.mjs)와 SPA 가 채운다.
//
// 아래 검사는 sanitizer 가 아니라 출력 계약 트립와이어다 — 원본은 레포에 커밋된 md 뿐이고,
// 어기면 빌드를 세운다. 이미지 빌드가 실패하면 Argo 가 직전 이미지를 유지한다.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderDiagram } from 'fencesvg';
import { Marked } from 'marked';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'src/content/search-architecture.md');
const OUTPUT = resolve(ROOT, 'src/pages/tech/generated/search-architecture.json');
const ID_PREFIX = 'ts-';
const GUIDES_SOURCE = resolve(ROOT, 'src/content/guides');
const GUIDES_OUTPUT = resolve(ROOT, 'src/pages/place/generated/guides');
const PLACE_LANDINGS = resolve(ROOT, 'src/content/place-landings.json');

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


// ─── 편집 페이지 ────────────────────────────────────────────────────────────

/** 편집 페이지 slug — nginx `/guides/{slug}` location 과 같은 규칙 */
export const GUIDE_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
/** 관광지 id — nginx 상세 location 과 같은 규칙(숫자 1~12자리) */
const GUIDE_CARD_ID_RE = /^[0-9]{1,12}$/;
/** 카드 표지의 정확한 형식. 값은 넓게 잡고 id 규칙은 따로 본다 — 형식과 id 를 각각 검사한다 */
const GUIDE_CARD_RE = /<div data-guide-card="([^"]*)"><\/div>/g;
const GUIDE_STATUSES = ['draft', 'published'];
/** 본문 안 속성 랜딩 링크 — 같은 출처 경로나 place 절대 주소 */
const LANDING_HREF_RE = /href="(?:https:\/\/place\.1989v\.com)?\/(en\/)?regions\/([^/"#?]+)\/([^/"#?]+)"/g;

/**
 * 머리말(`---` 사이) — `key: value` 한 줄씩. 값이 `[a, b]` 면 문자열 배열이다.
 * @returns {{ meta: Record<string, string | string[]>, body: string }}
 */
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) fail('머리말(--- … ---)이 없다');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const raw = kv[2].trim();
    const list = raw.match(/^\[(.*)\]$/);
    meta[kv[1]] = list
      ? list[1].split(',').map((v) => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : raw.replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(m[0].length) };
}

/**
 * 편집 페이지 원본 하나 → 생성 JSON 의 내용. 검사를 어기면 throw(빌드 실패).
 *
 * 본문 안 관광지 자리는 `<div data-guide-card="{id}"></div>` 표지다. 여기서 본문을 표지 경계로 잘라
 * `parts` 로 싣는다 — 분할 규칙은 이 한 곳에만 있고, 프리렌더·SPA 는 parts 를 그리기만 한다.
 * @param {string} source  md 원문(머리말 포함)
 * @param {{ slug: string, file: string, landings: Array<Record<string, any>> }} opts  file 은 실패 메시지·JSON 에 싣는 원본 경로
 */
export function renderGuide(source, { slug, file, landings }) {
  const where = (reason) => fail(`${file}: ${reason}`);
  if (!GUIDE_SLUG_RE.test(slug)) where(`slug 「${slug}」 는 영소문자·숫자·하이픈만 쓴다`);
  const { meta, body } = frontMatter(source);
  const text = (key) => (typeof meta[key] === 'string' ? meta[key] : '');
  for (const key of ['title', 'description']) if (!text(key)) where(`머리말 ${key} 가 비었다`);
  const status = text('status');
  if (!GUIDE_STATUSES.includes(status)) where(`머리말 status 는 draft | published — 「${status}」`);
  // 게시는 검수 뒤다 — 검수자·검수일이 없는 published 는 세운다
  if (status === 'published') {
    for (const key of ['reviewedBy', 'reviewedAt']) if (!text(key)) where(`published 인데 머리말 ${key} 가 비었다`);
  }
  const attractionIds = Array.isArray(meta.attractionIds) ? meta.attractionIds : null;
  if (!attractionIds || attractionIds.length === 0) where('머리말 attractionIds 가 비었다');

  const { html, headings } = renderContent(body, { idPrefix: 'gd-' });

  // 표지 — 출현 수 = 정확한 형식 일치 수, 값은 id 규칙, 집합은 attractionIds 와 같아야 한다
  const appear = (html.match(/data-guide-card/g) ?? []).length;
  const markers = [...html.matchAll(GUIDE_CARD_RE)].map((m) => m[1]);
  if (appear !== markers.length) {
    where(`카드 표지 출현 ${appear}회 중 정확한 형식(<div data-guide-card="{id}"></div>)은 ${markers.length}회`);
  }
  for (const id of [...markers, ...attractionIds]) {
    if (!GUIDE_CARD_ID_RE.test(id)) where(`관광지 id 형식 위반(숫자 1~12자리): ${id}`);
  }
  const markerSet = [...new Set(markers)].sort().join(',');
  const idSet = [...new Set(attractionIds)].sort().join(',');
  if (markerSet !== idSet) where(`본문 카드 표지 {${markerSet}} ≠ 머리말 attractionIds {${idSet}}`);

  // 속성 랜딩 링크 — 목록에 있고 은퇴하지 않은 것만
  for (const m of html.matchAll(LANDING_HREF_RE)) {
    const lang = m[1] ? 'en' : 'ko';
    const entry = landings.find((e) => e.lang === lang && e.code === m[2] && e.attr === m[3]);
    if (!entry) where(`목록(place-landings.json)에 없는 속성 랜딩 링크: ${m[0].slice(6, -1)}`);
    if (entry.retired) where(`은퇴한 속성 랜딩 링크: ${m[0].slice(6, -1)}`);
  }

  const parts = [];
  let last = 0;
  const pushHtml = (chunk) => {
    if (chunk.trim()) parts.push({ html: chunk });
  };
  for (const m of html.matchAll(GUIDE_CARD_RE)) {
    pushHtml(html.slice(last, m.index));
    parts.push({ cardId: m[1] });
    last = m.index + m[0].length;
  }
  pushHtml(html.slice(last));

  return {
    slug,
    title: text('title'),
    description: text('description'),
    status,
    reviewedBy: text('reviewedBy') || null,
    reviewedAt: text('reviewedAt') || null,
    attractionIds,
    source: file,
    headings,
    parts,
  };
}

async function renderGuides() {
  const landings = JSON.parse(await readFile(PLACE_LANDINGS, 'utf8'));
  let files = [];
  try {
    files = (await readdir(GUIDES_SOURCE)).filter((f) => f.endsWith('.md')).sort();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  // 지운 원본의 JSON 이 남지 않게 비우고 다시 만든다. 0장이어도 폴더는 만든다 — 프리렌더가 「렌더 단계가 빠진 빌드」와 구분한다
  await rm(GUIDES_OUTPUT, { recursive: true, force: true });
  await mkdir(GUIDES_OUTPUT, { recursive: true });
  for (const name of files) {
    const slug = name.slice(0, -3);
    const file = `portal-fe/src/content/guides/${name}`;
    const guide = renderGuide(await readFile(resolve(GUIDES_SOURCE, name), 'utf8'), { slug, file, landings });
    await writeFile(resolve(GUIDES_OUTPUT, `${slug}.json`), `${JSON.stringify(guide, null, 2)}\n`);
  }
  console.log(`[render-content] ${GUIDES_OUTPUT} — 편집 페이지 ${files.length}장`);
}

async function main() {
  await renderTechSearch();
  await renderGuides();
}

async function renderTechSearch() {
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
