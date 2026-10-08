// @vitest-environment node
import { describe, expect, it } from 'vitest';
// 실제 fencesvg·marked 로 렌더한다 — 렌더 결과가 곧 페이지·프리렌더가 싣는 HTML 이다.
import { renderContent, renderGuide, slugify } from '../../../scripts/render-content.mjs';

const FENCE = '```';

const FIXTURE = [
  '# 검색 아키텍처',
  '',
  '<!-- source: search/app -->',
  '',
  '- [관광 가중치](#관광-가중치)',
  '- [RRF](#rrf-rankconstant)',
  '',
  '## 1. 전체 구조',
  '',
  `${FENCE}mermaid`,
  '%% caption: 요청이 검색 서비스까지 가는 길',
  'flowchart LR',
  '  A[브라우저] -->|검색| B[gateway]',
  '  B -->|전달| C[search]',
  FENCE,
  '',
  '### 1.1 관광지 검색',
  '',
  `${FENCE}mermaid`,
  '%% caption: 검색 요청 하나의 순서',
  'sequenceDiagram',
  '  participant A as 브라우저',
  '  participant B as gateway',
  '  A->>B: 검색',
  '  B-->>A: 응답',
  FENCE,
  '',
  `${FENCE}mermaid`,
  '%% caption: 하이브리드 스위치 상태',
  'stateDiagram-v2',
  '  [*] --> 켜짐',
  '  켜짐 --> 꺼짐',
  FENCE,
  '',
  '## 4. 지금 쓰는 기법과 요소',
  '',
  '| 항목 | 현재 값 |',
  '|---|---|',
  '| 관광 가중치 | `1.0` |',
  '| RRF `rank_constant` | `60` |',
  '',
].join('\n');

const render = (md: string) => renderContent(md, { idPrefix: 'ts-', gitSha: 'test' });

const svgs = (html: string) => html.match(/<svg\b[\s\S]*?<\/svg>/g) ?? [];
const ids = (html: string) => [...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);

describe('renderContent', () => {
  describe('given 펜스 3종이 든 문서', () => {
    const { html, headings, warnings } = render(FIXTURE);

    it('then 펜스마다 figure 안에 role=img SVG 와 figcaption 이 하나씩 생긴다', () => {
      expect(html.match(/<svg\b[^>]*\brole="img"/g)).toHaveLength(3);
      expect(html.match(/<figure class="fs-figure">/g)).toHaveLength(3);
      expect(html.match(/<figcaption>/g)).toHaveLength(3);
      expect(html).toContain('<figcaption>검색 요청 하나의 순서</figcaption>');
      expect(html).not.toContain('language-mermaid');
      expect(warnings).toEqual([]);
    });

    it('then SVG 안에 빈 줄이 없고 출력 id 는 겹치지 않는다', () => {
      for (const svg of svgs(html)) expect(svg).not.toMatch(/\n[ \t]*\n/);
      const all = ids(html);
      expect(all.length).toBeGreaterThan(0);
      expect(new Set(all).size).toBe(all.length);
    });

    it('then 표는 kh-table 이고 머리 칸은 scope=col 이며 HTML 주석은 걷힌다', () => {
      expect(html).toContain('<table class="kh-table">');
      expect(html).toContain('<th scope="col"');
      expect(html).not.toContain('<!--');
    });

    it('then heading 마다 접두사 붙은 id 가 생기고 headings 로 모인다', () => {
      expect(headings).toEqual([
        { level: 1, id: 'ts-검색-아키텍처', text: '검색 아키텍처' },
        { level: 2, id: 'ts-1-전체-구조', text: '1. 전체 구조' },
        { level: 3, id: 'ts-11-관광지-검색', text: '1.1 관광지 검색' },
        { level: 2, id: 'ts-4-지금-쓰는-기법과-요소', text: '4. 지금 쓰는 기법과 요소' },
      ]);
      expect(html).toContain('<h2 id="ts-1-전체-구조">1. 전체 구조</h2>');
    });

    it('then §4 표 본문 행은 첫 칸 평문 slug 로 id 를 갖고, 요약 링크는 날 한글 href 로 그 행을 가리킨다', () => {
      expect(html).toContain('<tr id="ts-관광-가중치">');
      expect(html).toContain(`<tr id="ts-${slugify('RRF rank_constant')}">`);
      expect(html).toContain('<a href="#ts-관광-가중치">관광 가중치</a>');
      const links = [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]);
      expect(links).toHaveLength(2);
      for (const id of links) expect(html).toContain(`<tr id="${id}">`);
    });
  });

  describe('given 깨지거나 계약을 어기는 문서', () => {
    const cases: Array<[string, string, RegExp]> = [
      ['sequence 펜스에 rect 1줄', FIXTURE.replace('  B-->>A: 응답', '  rect rgb(0,0,0)\n  B-->>A: 응답\n  end'), /rect/],
      ['펜스 캡션 삭제', FIXTURE.replace('%% caption: 하이브리드 스위치 상태\n', ''), /캡션/],
      ['없는 앵커 링크', `${FIXTURE}\n[x](#nope)\n`, /죽은 앵커/],
      ['javascript: 링크', `${FIXTURE}\n[x](javascript:alert(1))\n`, /허용되지 않은 주소/],
      ['base 태그', `${FIXTURE}\n<base href="/">\n`, /금지 태그/],
      ['img onerror', `${FIXTURE}\n<div>\n<img src="/x" onerror="x">\n</div>\n`, /이벤트 속성/],
      ['svg/onload', `${FIXTURE}\n<div>\n<svg/onload=x>\n</div>\n`, /이벤트 속성/],
      ['금칙 패턴(클러스터 내부 주소)', `${FIXTURE}\nfoo.svc.cluster.local 로 부른다\n`, /금칙/],
    ];

    it.each(cases)('then %s 이면 원인을 담아 throw 한다', (_name, md, reason) => {
      expect(() => render(md)).toThrow(reason);
    });
  });
});

// ─── 편집 페이지(guides/*.md) ────────────────────────────────────────────────

const LANDINGS = [
  { lang: 'ko', code: '11110', sidoCode: '11', attr: 'free', count: 68, jaccardMax: 0, selectedAt: '2026-10-09' },
  { lang: 'ko', code: '11140', sidoCode: '11', attr: 'free', count: 20, jaccardMax: 0, selectedAt: '2026-10-09', retired: true, retiredAt: '2026-10-10' },
];

const guideSource = (
  { status = 'draft', reviewedBy = '', reviewedAt = '', ids = '[101, 102]' }: Partial<Record<'status' | 'reviewedBy' | 'reviewedAt' | 'ids', string>> = {},
  body = [
    '| 후보 | 조건 |',
    '|---|---|',
    '| 가 | 무료 |',
    '',
    '## 후보',
    '',
    '첫 문단이다.',
    '',
    '<div data-guide-card="101"></div>',
    '',
    '가운데 문단이다.',
    '',
    '<div data-guide-card="102"></div>',
    '',
    '[종로구 무료 관광지](/regions/11110/free)',
    '',
  ].join('\n'),
) =>
  [
    '---',
    'title: 서울 무료 실내 관광지',
    'description: 서울에서 입장료 없이 실내에서 볼 수 있는 곳',
    `status: ${status}`,
    `reviewedBy: ${reviewedBy}`,
    `reviewedAt: ${reviewedAt}`,
    `attractionIds: ${ids}`,
    '---',
    '',
    body,
  ].join('\n');

const guide = (source: string) => renderGuide(source, { slug: 'seoul-free', file: 'src/content/guides/seoul-free.md', landings: LANDINGS });

describe('renderGuide', () => {
  it('정상 원본 → 머리말과 parts(html·cardId 순서 보존)', () => {
    const g = guide(guideSource());
    expect(g).toMatchObject({
      slug: 'seoul-free',
      title: '서울 무료 실내 관광지',
      status: 'draft',
      attractionIds: ['101', '102'],
      source: 'src/content/guides/seoul-free.md',
    });
    expect(g.parts.map((p) => ('cardId' in p ? `card:${p.cardId}` : 'html'))).toEqual([
      'html',
      'card:101',
      'html',
      'card:102',
      'html',
    ]);
    // 조각을 이으면 표지만 빠진 본문이다 — 분할이 내용을 잃지 않는다
    const joined = g.parts.map((p) => ('html' in p ? p.html : '')).join('');
    expect(joined).not.toContain('data-guide-card');
    expect(joined).toContain('첫 문단이다.');
    expect(joined).toContain('가운데 문단이다.');
    expect(joined).toContain('href="/regions/11110/free"');
  });

  it('published 인데 검수자·검수일이 비면 실패', () => {
    expect(() => guide(guideSource({ status: 'published' }))).toThrow(/reviewedBy/);
    expect(() => guide(guideSource({ status: 'published', reviewedBy: '권기덕' }))).toThrow(/reviewedAt/);
    expect(guide(guideSource({ status: 'published', reviewedBy: '권기덕', reviewedAt: '2026-10-10' })).status).toBe('published');
  });

  it('표지 id 가 13자리면(집합은 일치) 형식 위반으로 실패', () => {
    const body = '| a | b |\n|---|---|\n| 1 | 2 |\n\n## x\n\n<div data-guide-card="1234567890123"></div>\n';
    expect(() => guide(guideSource({ ids: '[1234567890123]' }, body))).toThrow(/형식/);
  });

  it('표지 집합이 attractionIds 와 다르면 실패', () => {
    const body = '| a | b |\n|---|---|\n| 1 | 2 |\n\n## x\n\n<div data-guide-card="101"></div>\n';
    expect(() => guide(guideSource({ ids: '[101, 102]' }, body))).toThrow(/attractionIds/);
  });

  it('홑따옴표 표지는 출현 수 ≠ 형식 일치 수로 실패', () => {
    const body = "| a | b |\n|---|---|\n| 1 | 2 |\n\n## x\n\n<div data-guide-card='101'></div>\n";
    expect(() => guide(guideSource({ ids: '[101]' }, body))).toThrow(/출현/);
  });

  it.each([
    ['은퇴 랜딩', '/regions/11140/free'],
    ['목록 밖 랜딩', '/regions/11110/parking'],
  ])('%s 링크면 실패', (_name, href) => {
    const body = `| a | b |\n|---|---|\n| 1 | 2 |\n\n## x\n\n<div data-guide-card="101"></div>\n\n[랜딩](${href})\n`;
    expect(() => guide(guideSource({ ids: '[101]' }, body))).toThrow(/랜딩/);
  });
});
