import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TreemapView from '../TreemapView';
import type { TreemapDataDto } from '../../../api/treemap';

/**
 * TreemapView component tests.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.1, §6.9
 * Plan: planning/test-quality.md §Component Tests + planning/tasks.md T2.8
 *
 * recharts <ResponsiveContainer> needs ResizeObserver + a measurable parent;
 * we stub both so the tree mounts in jsdom.
 */

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  // jsdom does not implement ResizeObserver — recharts ResponsiveContainer needs it
  vi.stubGlobal('ResizeObserver', MockResizeObserver);

  // matchMedia for useIsMobile()
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  // useIsMobile() reads window.matchMedia explicitly
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: window.matchMedia ?? vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const SAMPLE_DATA: TreemapDataDto = {
  categories: [
    {
      name: 'ARCHITECTURE',
      totalConcepts: 3,
      totalIndexCount: 24,
      concepts: [
        { conceptId: 'clean-architecture', name: 'Clean Architecture', level: 'INTERMEDIATE', indexCount: 12 },
        { conceptId: 'hexagonal', name: 'Hexagonal', level: 'BEGINNER', indexCount: 7 },
        { conceptId: 'event-driven', name: 'Event Driven', level: 'ADVANCED', indexCount: 5 },
      ],
    },
  ],
  totals: {
    byLevel: { BEGINNER: 1, INTERMEDIATE: 1, ADVANCED: 1 },
    byCategory: { ARCHITECTURE: 3 },
    totalConcepts: 3,
    totalIndexCount: 24,
  },
};

const EMPTY_DATA: TreemapDataDto = {
  categories: [],
  totals: {
    byLevel: {},
    byCategory: {},
    totalConcepts: 0,
    totalIndexCount: 0,
  },
};

describe('TreemapView (code-dictionary)', () => {
  it('renders the treemap container with non-empty data', () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <TreemapView data={SAMPLE_DATA} onTileClick={() => {}} />
      </div>,
    );

    // accessible tree wrapper produced by TreemapView when data is present
    const tree = screen.getByRole('tree', { name: /카테고리별 concept 분포 트리맵/ });
    expect(tree).toBeInTheDocument();
  });

  it('renders "데이터 없음" placeholder when no categories are provided', () => {
    render(<TreemapView data={EMPTY_DATA} onTileClick={() => {}} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('데이터 없음');
    // tree wrapper should NOT render for empty state
    expect(screen.queryByRole('tree')).toBeNull();
  });

  it('renders "데이터 없음" when every category has zero concepts', () => {
    const allEmpty: TreemapDataDto = {
      categories: [
        { name: 'ARCHITECTURE', totalConcepts: 0, totalIndexCount: 0, concepts: [] },
        { name: 'DATABASE', totalConcepts: 0, totalIndexCount: 0, concepts: [] },
      ],
      totals: {
        byLevel: {},
        byCategory: { ARCHITECTURE: 0, DATABASE: 0 },
        totalConcepts: 0,
        totalIndexCount: 0,
      },
    };

    render(<TreemapView data={allEmpty} onTileClick={() => {}} />);

    expect(screen.getByRole('status')).toHaveTextContent('데이터 없음');
  });
});
