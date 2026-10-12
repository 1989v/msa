import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 기대값은 전부 생성 JSON(온톨로지에서 내보낸 드릴다운 데이터)에서 계산한다 — 온톨로지의 문장 · 구조가
 * 바뀌어도 이 테스트는 페이지가 그 데이터를 규칙대로 그리고 펼치는지만 본다.
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

import generated from '../generated/search-drill.json';
import { PORTAL_PAGES } from '../../../seo/copy.mjs';
import { STATUS_LABEL } from '../drillModel.mjs';
import SearchArchitecturePage from '../SearchArchitecturePage';

type Node = { id: string; lanes?: string[] };
type Concept = { name: string; description: string; applied?: { status: keyof typeof STATUS_LABEL; summary?: string }; code?: { path: string; start: number; end: number }[] };
const concepts = generated.concepts as unknown as Record<string, Concept>;
const diagrams = generated.diagrams as unknown as Record<string, { nodes: Node[]; edges: unknown[]; related: string[] }>;
const rootNodes = diagrams[generated.root].nodes;
const drawn = (owner: string) => diagrams[owner].nodes.flatMap((n) => [n.id, ...(n.lanes ?? [])]);
/** 그림이 있는 1단계 노드 하나와, 그 그림 안에서 다시 그림이 있는 노드 하나 — 데이터에서 고른다 */
const first = rootNodes.map((n) => n.id).find((id) => diagrams[id] && drawn(id).some((c) => diagrams[c]))!;
const second = drawn(first).find((c) => diagrams[c])!;
/** 코드가 있는 아무 개념 */
const withCode = Object.entries(concepts).find(([id, c]) => c.code?.length && drawn(generated.root).includes(id))!;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tech/search']}>
      <SearchArchitecturePage />
    </MemoryRouter>,
  );
}

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nodeButton = (scope: HTMLElement, id: string) =>
  within(scope).getByRole('button', { name: new RegExp(`^${esc(concepts[id].name)}(,|$)`) });

afterEach(() => window.history.replaceState(null, '', '/'));

describe('SearchArchitecturePage', () => {
  it('1단계 그림에 루트 그림의 노드 · 묶음 단계가 전부 있고, 상태를 이름과 함께 읽힌다', () => {
    renderPage();
    const board = screen.getByRole('group', { name: `${concepts[generated.root].name} 다이어그램` });
    for (const id of drawn(generated.root)) {
      const status = concepts[id].applied?.status;
      const name = new RegExp(`^${esc(concepts[id].name)}${status ? `, ${STATUS_LABEL[status]}` : ''}`);
      expect(within(board).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('노드를 누르면 아래에 상세가 열린다 — 상세 다이어그램이 탭보다 위, 탭은 개념 · 현재 적용 상태 · 코드', () => {
    const { container } = renderPage();
    fireEvent.click(nodeButton(container, first));
    const level = screen.getByRole('region', { name: `${concepts[first].name} 상세` });
    const sub = within(level).getByRole('group', { name: `${concepts[first].name} 다이어그램` });
    const tabs = within(level).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['개념', '현재 적용 상태', '코드']);
    expect(sub.compareDocumentPosition(tabs[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(level).getByRole('tabpanel').textContent).toBe(concepts[first].description);
    expect(window.location.hash).toBe(`#${first}`);
  });

  it('상세 다이어그램의 노드를 누르면 한 단계 더 열리고, 위 단계 노드를 다시 누르면 아래가 모두 접힌다', () => {
    const { container } = renderPage();
    fireEvent.click(nodeButton(container, first));
    const level1 = screen.getByRole('region', { name: `${concepts[first].name} 상세` });
    fireEvent.click(nodeButton(within(level1).getByRole('group', { name: `${concepts[first].name} 다이어그램` }), second));
    expect(screen.getByRole('region', { name: `${concepts[second].name} 상세` })).toBeInTheDocument();
    expect(screen.getByText(`2단계 · ${concepts[first].name} › ${concepts[second].name}`)).toBeInTheDocument();

    fireEvent.click(nodeButton(screen.getByRole('group', { name: `${concepts[generated.root].name} 다이어그램` }), first));
    expect(screen.queryAllByRole('region', { name: /상세$/ })).toHaveLength(0);
  });

  it('현재 적용 상태 탭은 적용 서술을, 코드 탭은 빌드 커밋으로 고정한 GitHub 링크를 보인다', () => {
    const [id, c] = withCode;
    const { container } = renderPage();
    fireEvent.click(nodeButton(container, id));
    const level = screen.getByRole('region', { name: `${c.name} 상세` });
    fireEvent.click(within(level).getByRole('tab', { name: '현재 적용 상태' }));
    if (c.applied?.summary) expect(within(level).getByRole('tabpanel').textContent).toContain(c.applied.summary);
    fireEvent.click(within(level).getByRole('tab', { name: '코드' }));
    const ref = c.code![0];
    const link = within(level).getByRole('link', { name: /GitHub/ });
    const rev = generated.gitSha === 'dev' ? 'main' : generated.gitSha;
    expect(link.getAttribute('href')).toBe(`https://github.com/1989v/msa/blob/${rev}/${ref.path}#L${ref.start}-L${ref.end}`);
  });

  it('해시(#개념 id)로 열면 그 단계까지 펼친 상태로 시작한다', () => {
    window.history.replaceState(null, '', `/tech/search#${second}`);
    renderPage();
    expect(screen.getByRole('region', { name: `${concepts[first].name} 상세` })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: `${concepts[second].name} 상세` })).toBeInTheDocument();
  });

  it('K-Heritage 표면을 켜고, 루트에 원본 해시 · 상단에 빌드 커밋 · 갱신일 줄', () => {
    const { container } = renderPage();
    expect(heritage).toHaveBeenCalled();
    expect(container.querySelector('[data-source-hash]')?.getAttribute('data-source-hash')).toBe(generated.sourceHash);
    expect(screen.getByText(`빌드 커밋 ${generated.gitSha} · 갱신 ${generated.updated}`)).toBeInTheDocument();
  });

  it('SEO 는 canonical 과 TechArticle · BreadcrumbList 를 주고 og:type 은 정하지 않는다', () => {
    renderPage();
    const input = seo.mock.calls.at(-1)?.[0];
    expect(input.title).toBe(PORTAL_PAGES['/tech/search'].title);
    expect(input.description).toBe(PORTAL_PAGES['/tech/search'].description);
    expect(input.canonical).toBe('https://1989v.com/tech/search');
    expect(input.type).toBeUndefined();
    expect(input.jsonLd.map((j: { '@type': string }) => j['@type'])).toEqual(['TechArticle', 'BreadcrumbList']);
    expect(input.jsonLd[0].dateModified).toBe(generated.updated);
  });
});
