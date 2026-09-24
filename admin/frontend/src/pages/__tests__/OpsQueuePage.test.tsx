import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OpsQueuePage } from '../OpsQueuePage';
import * as opsApi from '@/api/opsIssues';
import type { OpsDomain, OpsIssue } from '@/api/opsIssues';

vi.mock('@/api/opsIssues', async () => {
  const actual = await vi.importActual<typeof opsApi>('@/api/opsIssues');
  return { ...actual, listOpsIssues: vi.fn(), retryOpsIssue: vi.fn(), closeOpsIssue: vi.fn() };
});

const issue = (over: Partial<OpsIssue>): OpsIssue => ({
  id: 1,
  type: 'DLT',
  targetId: 'inventory.command.reserve@0:5',
  detail: 'inventory.command.reserve key=7',
  businessDate: null,
  status: 'OPEN',
  actorId: null,
  reason: null,
  createdAt: '2026-09-24T01:00:00Z',
  updatedAt: '2026-09-24T01:00:00Z',
  ...over,
});

describe('OpsQueuePage', () => {
  beforeEach(() => {
    vi.mocked(opsApi.listOpsIssues).mockReset();
  });

  it('여덟 도메인을 동시에 부르고, 한 도메인이 실패해도 나머지 도메인의 이슈를 한 목록으로 보여 준다', async () => {
    vi.mocked(opsApi.listOpsIssues).mockImplementation(async (d: OpsDomain) => {
      if (d.key === 'payment') throw new Error('502');
      if (d.key === 'inventory') return { items: [issue({ id: 3 })], total: 1 };
      if (d.key === 'order') return { items: [issue({ id: 3, type: 'SAGA_STUCK', targetId: '42', createdAt: '2026-09-24T02:00:00Z' })], total: 1 };
      return { items: [], total: 0 };
    });

    render(<OpsQueuePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('결제');
    expect(opsApi.listOpsIssues).toHaveBeenCalledTimes(8);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    // 최근 생성 순 — 같은 id 라도 도메인이 다르면 다른 줄
    expect(within(rows[0]).getByText('주문')).toBeInTheDocument();
    expect(within(rows[1]).getByText('재고')).toBeInTheDocument();
  });
});
