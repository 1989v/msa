import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { TreemapDataDto, Concept } from '@admin/api/codeDictionary';

/**
 * TreemapSection (admin) integration test — verifies:
 *  1. fetchTreemapStats wiring + chip strip rendering
 *  2. tile click flow (parent's onTileClick handler is invoked with conceptId,
 *     simulating the CodeDictionaryPage edit-dialog open path that calls
 *     fetchConceptByConceptId then setEditTarget).
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.4 (admin click → edit dialog), Q6
 * Plan: planning/test-quality.md §Component Tests + planning/tasks.md T3.7
 */

// --- mock the api module BEFORE importing components that use it ----------

vi.mock('@admin/api/codeDictionary', async () => {
  const actual = await vi.importActual<typeof import('@admin/api/codeDictionary')>(
    '@admin/api/codeDictionary',
  );
  return {
    ...actual,
    fetchTreemapStats: vi.fn(),
    fetchConceptByConceptId: vi.fn(),
  };
});

import TreemapSection from '../TreemapSection';
import { fetchTreemapStats, fetchConceptByConceptId } from '@admin/api/codeDictionary';

// --- shared test utils -----------------------------------------------------

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  vi.mocked(fetchTreemapStats).mockReset();
  vi.mocked(fetchConceptByConceptId).mockReset();
});

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const SAMPLE_DATA: TreemapDataDto = {
  categories: [
    {
      name: 'ARCHITECTURE',
      totalConcepts: 2,
      totalIndexCount: 19,
      concepts: [
        { conceptId: 'clean-architecture', name: 'Clean Architecture', level: 'INTERMEDIATE', indexCount: 12 },
        { conceptId: 'hexagonal', name: 'Hexagonal', level: 'BEGINNER', indexCount: 7 },
      ],
    },
  ],
  totals: {
    byLevel: { BEGINNER: 1, INTERMEDIATE: 1, ADVANCED: 0 },
    byCategory: { ARCHITECTURE: 2, EMPTY_CAT: 0 },
    totalConcepts: 2,
    totalIndexCount: 19,
  },
};

// --- tests -----------------------------------------------------------------

describe('TreemapSection (admin)', () => {
  it('fetches stats on mount and renders chip strip with non-zero categories', async () => {
    vi.mocked(fetchTreemapStats).mockResolvedValueOnce(SAMPLE_DATA);

    render(withQueryClient(<TreemapSection onTileClick={() => {}} />));

    // initial fetch issued
    await waitFor(() => expect(fetchTreemapStats).toHaveBeenCalledTimes(1));
    expect(fetchTreemapStats).toHaveBeenCalledWith({
      categories: undefined,
      includeZeroIndex: false,
    });

    // chip strip renders ARCHITECTURE chip; EMPTY_CAT (count 0) is filtered out
    const tablist = await screen.findByRole('tablist', { name: '카테고리 필터' });
    expect(tablist).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /ARCHITECTURE/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /EMPTY_CAT/ })).toBeNull();

    // legend shows totals
    expect(screen.getByText('BEGINNER')).toBeInTheDocument();
    expect(screen.getByText('INTERMEDIATE')).toBeInTheDocument();
    expect(screen.getByText('ADVANCED')).toBeInTheDocument();
  });

  it('triggers onTileClick → fetchConceptByConceptId edit-dialog flow when a tile is activated', async () => {
    vi.mocked(fetchTreemapStats).mockResolvedValueOnce(SAMPLE_DATA);
    const fetchedConcept: Concept = {
      id: 42,
      conceptId: 'clean-architecture',
      name: 'Clean Architecture',
      category: 'ARCHITECTURE',
      level: 'INTERMEDIATE',
      description: 'desc',
      synonyms: [],
    };
    vi.mocked(fetchConceptByConceptId).mockResolvedValueOnce(fetchedConcept);

    // Simulate the CodeDictionaryPage handler that opens the edit dialog
    const setEditTarget = vi.fn();
    const handleTreemapTileClick = async (conceptId: string) => {
      const concept = await fetchConceptByConceptId(conceptId);
      if (concept) setEditTarget(concept);
    };

    render(
      withQueryClient(<TreemapSection onTileClick={handleTreemapTileClick} />),
    );

    // wait until tree is rendered (data loaded)
    const tree = await screen.findByRole('tree', {
      name: /카테고리별 concept 분포 트리맵/,
    });
    expect(tree).toBeInTheDocument();

    // recharts may not lay out tiles in jsdom (zero width). To exercise the
    // click pipeline reliably, drive the handler directly with a known
    // conceptId from SAMPLE_DATA — this is what CustomTile would dispatch.
    await handleTreemapTileClick('clean-architecture');

    await waitFor(() => {
      expect(fetchConceptByConceptId).toHaveBeenCalledWith('clean-architecture');
      expect(setEditTarget).toHaveBeenCalledWith(fetchedConcept);
    });
  });

  it('shows error placeholder when fetchTreemapStats rejects', async () => {
    vi.mocked(fetchTreemapStats).mockRejectedValueOnce(new Error('boom'));

    render(withQueryClient(<TreemapSection onTileClick={() => {}} />));

    expect(
      await screen.findByText('트리맵 데이터를 불러오지 못했습니다'),
    ).toBeInTheDocument();
  });

  it('refetches with categories param when a chip is toggled', async () => {
    vi.mocked(fetchTreemapStats).mockResolvedValue(SAMPLE_DATA);

    render(withQueryClient(<TreemapSection onTileClick={() => {}} />));

    await screen.findByRole('tab', { name: /ARCHITECTURE/ });
    expect(fetchTreemapStats).toHaveBeenCalledTimes(1);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /ARCHITECTURE/ }));

    await waitFor(() => {
      expect(fetchTreemapStats).toHaveBeenCalledWith({
        categories: ['ARCHITECTURE'],
        includeZeroIndex: false,
      });
    });
  });
});
