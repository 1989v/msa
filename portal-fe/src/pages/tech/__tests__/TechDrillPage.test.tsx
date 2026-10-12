import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 기대값은 전부 생성 JSON(온톨로지에서 내보낸 드릴다운 데이터)에서 계산한다 — 온톨로지의 문장 · 구조가
 * 바뀌어도 이 테스트는 페이지가 그 데이터를 규칙대로 그리고 펼치는지만 본다. 드릴다운 도메인마다 같은 검사를 돈다.
 */

const heritage = vi.hoisted(() => vi.fn());
const seo = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useHeritageSurface', () => ({
  useHeritageSurface: heritage,
  useHeritageTheme: () => ['light', () => undefined],
}));
vi.mock('../../../seo/useSeo', () => ({ useSeo: seo }));
vi.mock('../../../components/AuthButton', () => ({ default: () => null }));
vi.mock('../../../api/resumeApi', () => ({ fetchResumeStatus: () => Promise.resolve(false) }));

import searchData from '../generated/search-drill.json';
import recommendationData from '../generated/recommendation-drill.json';
import orderData from '../generated/commerce-order-drill.json';
import { PORTAL_PAGES } from '../../../seo/copy.mjs';
import { STATUS_LABEL } from '../drillModel.mjs';
import { DRILL_PAGES } from '../drillPages.mjs';
import SearchArchitecturePage from '../SearchArchitecturePage';
import RecommendationArchitecturePage from '../RecommendationArchitecturePage';
import OrderArchitecturePage from '../OrderArchitecturePage';

type Node = { id: string; lanes?: string[] };
type Concept = { name: string; description: string; applied?: { status: keyof typeof STATUS_LABEL; summary?: string }; code?: { path: string; start: number; end: number }[] };
type Data = {
  root: string;
  updated: string;
  maxDepth: number;
  sourceHash: string;
  gitSha: string;
  concepts: Record<string, Concept>;
  diagrams: Record<string, { nodes: Node[]; edges: unknown[]; related: string[] }>;
};

const PAGES: Record<string, { Page: ComponentType; data: Data }> = {
  search: { Page: SearchArchitecturePage, data: searchData as unknown as Data },
  recommendation: { Page: RecommendationArchitecturePage, data: recommendationData as unknown as Data },
  'commerce-order': { Page: OrderArchitecturePage, data: orderData as unknown as Data },
};

it('드릴다운 페이지 목록의 도메인마다 페이지 컴포넌트가 있다', () => {
  expect(DRILL_PAGES.map((p) => p.domain).sort()).toEqual(Object.keys(PAGES).sort());
});

afterEach(() => window.history.replaceState(null, '', '/'));

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe.each(DRILL_PAGES)('$path', (page) => {
  const { Page, data } = PAGES[page.domain];
  const { concepts, diagrams } = data;
  const drawn = (owner: string) => diagrams[owner].nodes.flatMap((n) => [n.id, ...(n.lanes ?? [])]);
  const hasPicture = (id: string) => (diagrams[id]?.nodes.length ?? 0) > 0;
  /** 1단계 그림이 이미 그린 개념(묶음 안 단계 포함) — 이것들은 해시로 열면 1단계에서 열린다 */
  const atRoot = new Set(drawn(data.root));
  const deeper = (owner: string) => drawn(owner).filter((id) => !atRoot.has(id));
  /** 그림이 있는 1단계 노드 하나와, 그 그림에서 처음 나오면서 다시 그림이 있는 노드 하나 — 데이터에서 고른다 */
  const first = drawn(data.root).find((id) => hasPicture(id) && deeper(id).some(hasPicture))!;
  const second = deeper(first).find(hasPicture)!;
  /** 1단계 노드의 그림에서 처음 나오는, 하위 개념이 아예 없는 노드 — 펼치면 그림 대신 안내 문장이 나와야 한다 */
  const leafAt = drawn(data.root)
    .filter(hasPicture)
    .flatMap((owner) => deeper(owner).filter((id) => !diagrams[id]).map((id) => ({ owner, id })))[0];
  /** 하위 개념은 있지만 흐름이 없어 노드가 0개인 그림 */
  const listOnly = drawn(data.root).find((id) => diagrams[id] && !hasPicture(id) && diagrams[id].related.length > 0);
  /** 코드가 있는 아무 개념 — 해시로 그 단계까지 연다 */
  const withCode = Object.entries(concepts).find(([, c]) => c.code?.length);

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={[page.path]}>
        <Page />
      </MemoryRouter>,
    );
  const nodeButton = (scope: HTMLElement, id: string) =>
    within(scope).getByRole('button', { name: new RegExp(`^${esc(concepts[id].name)}(,|$)`) });
  const level = (id: string) => screen.getByRole('region', { name: `${concepts[id].name} 상세` });

  it('h1 은 페이지 제목이고, 1단계 그림에 루트 그림의 노드 · 묶음 단계가 전부 상태와 함께 읽힌다', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(page.title);
    const board = screen.getByRole('group', { name: `${concepts[data.root].name} 다이어그램` });
    for (const id of drawn(data.root)) {
      const status = concepts[id].applied?.status;
      const name = new RegExp(`^${esc(concepts[id].name)}${status ? `, ${STATUS_LABEL[status]}` : ''}`);
      expect(within(board).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('노드를 누르면 아래에 상세가 열린다 — 상세 다이어그램이 탭보다 위, 탭은 개념 · 현재 적용 상태 · 코드', () => {
    const { container } = renderPage();
    fireEvent.click(nodeButton(container, first));
    const l1 = level(first);
    const sub = within(l1).getByRole('group', { name: `${concepts[first].name} 다이어그램` });
    const tabs = within(l1).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['개념', '현재 적용 상태', '코드']);
    expect(sub.compareDocumentPosition(tabs[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(l1).getByRole('tabpanel').textContent).toBe(concepts[first].description);
    expect(window.location.hash).toBe(`#${first}`);
  });

  it('2단계는 1단계 안에 들어가 그 탭 뒤에 놓이고, 위 단계 노드를 다시 누르면 아래가 모두 접힌다', () => {
    const { container } = renderPage();
    fireEvent.click(nodeButton(container, first));
    const l1 = level(first);
    fireEvent.click(nodeButton(within(l1).getByRole('group', { name: `${concepts[first].name} 다이어그램` }), second));
    const l2 = level(second);
    // 경계가 보이도록 다음 단계를 앞 단계 안에 품는다 — 형제로 늘어놓지 않는다
    expect(l1.contains(l2)).toBe(true);
    const l1Tabs = within(l1).getAllByRole('tablist')[0];
    expect(l1Tabs.compareDocumentPosition(l2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(`2단계 · ${concepts[first].name} › ${concepts[second].name}`)).toBeInTheDocument();

    fireEvent.click(nodeButton(screen.getByRole('group', { name: `${concepts[data.root].name} 다이어그램` }), first));
    expect(screen.queryAllByRole('region', { name: /상세$/ })).toHaveLength(0);
  });

  it('하위 개념이 없는 노드를 열면 그림 자리에 그 이유를 말한다', () => {
    expect(leafAt, '하위 개념이 없는 2단계 노드가 데이터에 없다').toBeDefined();
    const { container } = renderPage();
    fireEvent.click(nodeButton(container, leafAt.owner));
    const sub = within(level(leafAt.owner)).getByRole('group', { name: `${concepts[leafAt.owner].name} 다이어그램` });
    fireEvent.click(nodeButton(sub, leafAt.id));
    expect(within(level(leafAt.id)).getByText(/더 나뉘는 하위 단계가 없는 개념이다/)).toBeInTheDocument();
  });

  it.runIf(Boolean(listOnly))('하위 개념끼리 흐름이 없는 단계는 그림 대신 하위 개념 목록을 연다', () => {
    const { container } = renderPage();
    fireEvent.click(nodeButton(container, listOnly!));
    const l1 = level(listOnly!);
    expect(within(l1).queryByRole('group', { name: `${concepts[listOnly!].name} 다이어그램` })).toBeNull();
    expect(within(l1).getByText('하위 개념')).toBeInTheDocument();
    for (const id of diagrams[listOnly!].related) expect(within(l1).getByRole('button', { name: new RegExp(`^${esc(concepts[id].name)}`) })).toBeInTheDocument();
  });

  it('현재 적용 상태 탭은 적용 서술을, 코드 탭은 빌드 커밋으로 고정한 GitHub 링크를 보인다', () => {
    expect(withCode, '코드가 있는 개념이 데이터에 없다').toBeDefined();
    const [id, c] = withCode!;
    window.history.replaceState(null, '', `${page.path}#${id}`);
    renderPage();
    const l = level(id);
    fireEvent.click(within(l).getByRole('tab', { name: '현재 적용 상태' }));
    if (c.applied?.summary) expect(within(l).getByRole('tabpanel').textContent).toContain(c.applied.summary);
    fireEvent.click(within(l).getByRole('tab', { name: '코드' }));
    const ref = c.code![0];
    const link = within(l).getByRole('link', { name: /GitHub/ });
    const rev = data.gitSha === 'dev' ? 'main' : data.gitSha;
    expect(link.getAttribute('href')).toBe(`https://github.com/1989v/msa/blob/${rev}/${ref.path}#L${ref.start}-L${ref.end}`);
  });

  it('해시(#개념 id)로 열면 그 단계까지 펼친 상태로 시작한다', () => {
    window.history.replaceState(null, '', `${page.path}#${second}`);
    renderPage();
    expect(level(first)).toBeInTheDocument();
    expect(level(second)).toBeInTheDocument();
  });

  it('K-Heritage 표면을 켜고, 루트에 원본 해시 · 상단에 빌드 커밋 · 갱신일 줄', () => {
    const { container } = renderPage();
    expect(heritage).toHaveBeenCalled();
    expect(container.querySelector('[data-source-hash]')?.getAttribute('data-source-hash')).toBe(data.sourceHash);
    expect(screen.getByText(`빌드 커밋 ${data.gitSha} · 갱신 ${data.updated}`)).toBeInTheDocument();
  });

  it('SEO 는 canonical 과 TechArticle · BreadcrumbList 를 주고 og:type 은 정하지 않는다', () => {
    renderPage();
    const input = seo.mock.calls.at(-1)?.[0];
    const meta = PORTAL_PAGES[page.path as keyof typeof PORTAL_PAGES];
    expect(input.title).toBe(meta.title);
    expect(input.description).toBe(meta.description);
    expect(input.canonical).toBe(`https://1989v.com${page.path}`);
    expect(input.type).toBeUndefined();
    expect(input.jsonLd.map((j: { '@type': string }) => j['@type'])).toEqual(['TechArticle', 'BreadcrumbList']);
    expect(input.jsonLd[0].dateModified).toBe(data.updated);
    expect(input.jsonLd[0].headline).toBe(page.title);
  });
});
