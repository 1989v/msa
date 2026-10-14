import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@/api/stewards';
import { MarketStewardsPage } from '../../MarketStewardsPage';
vi.mock('@/api/stewards', () => ({ listStewards: vi.fn(), decideSteward: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('steward admin list', () => {
  it('defaults to pending and requires inline confirmation before decision', async () => {
    vi.mocked(api.listStewards).mockResolvedValue({ items: [{ id: 9, marketId: 7, memberId: 4, orgName: '중앙상인회', contact: '010-1234', status: 'PENDING', createdAt: '2026-10-15T09:00:00' }], total: 1, page: 0, size: 20 }); vi.mocked(api.decideSteward).mockResolvedValue(); render(<MarketStewardsPage />);
    expect(await screen.findByText('중앙상인회 · 승인 대기')).toBeInTheDocument(); expect(api.listStewards).toHaveBeenCalledWith('PENDING', 0);
    fireEvent.click(screen.getByRole('button', { name: '승인' })); expect(api.decideSteward).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '취소' })); expect(screen.queryByRole('button', { name: '승인 확인' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '반려' })); fireEvent.click(screen.getByRole('button', { name: '반려 확인' })); await waitFor(() => expect(api.decideSteward).toHaveBeenCalledWith(9, 'REJECT')); await waitFor(() => expect(api.listStewards).toHaveBeenCalledTimes(2));
  });
});
