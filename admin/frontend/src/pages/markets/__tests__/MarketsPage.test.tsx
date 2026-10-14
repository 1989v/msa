import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@/api/markets';
import type { Detail, StoreRow } from '@/api/markets';
import { MarketsPage } from '../../MarketsPage';
import { StoreEditor } from '../StoreEditor';
vi.mock('@/api/markets', async () => ({ ...await vi.importActual<typeof api>('@/api/markets'), listMarkets: vi.fn(), getMarket: vi.fn(), getChanges: vi.fn(), revertChange: vi.fn(), overrideStore: vi.fn() }));
const row: StoreRow = { source: { id: 2, marketId: 1, name: '원천', source: 'ONNURI', membership: { status: 'IN' }, items: null, zoneId: null, pinKind: 'EXACT', latitude: 37.5, longitude: 127, referenceStoreId: null, relativePosition: null, positionNote: null, actorKind: null }, display: { name: '가게', items: null, zoneId: null, membership: { status: 'IN' }, coordinate: { latitude: 37.5, longitude: 127 }, pinKind: 'EXACT' }, overrides: [{ field: 'NAME', value: '가게', reason: '기존 이유', memberId: 1 }] };
const detail: Detail = { market: { id: 1, name: '테스트시장', marketType: 'STREET', latitude: 37.5, longitude: 127 }, zones: [], stores: [row] };
describe('market editor components', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.listMarkets).mockResolvedValue({ items: [detail.market], page: 0, size: 20, total: 1 }); vi.mocked(api.getMarket).mockResolvedValue(detail); vi.mocked(api.getChanges).mockResolvedValue({ items: [{ id: 9, target: 'STORE', targetId: 2, action: 'OVERRIDE', memberId: 7, actorKind: 'ADMIN', beforeRaw: null, afterRaw: '{}', createdAt: '2026-10-15T01:00:00' }], total: 1, page: 0, size: 20 }); });
  it('disables override save and clear without a trimmed reason, sends whitelist fields and trim', async () => {
    const run = vi.fn(async (action: () => Promise<void>) => { await action(); return true; });
    render(<StoreEditor detail={detail} row={row} mode="override" coordinate={null} run={run} close={vi.fn()} />);
    const save = screen.getByRole('button', { name: '가게 저장' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('수정 이유 (필수)'), { target: { value: '   ' } });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByLabelText('name'));
    expect(screen.getByRole('button', { name: '선택 보정 해제' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('수정 이유 (필수)'), { target: { value: '  확인함  ' } });
    fireEvent.change(screen.getByLabelText('가게 이름'), { target: { value: '새 이름' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(api.overrideStore).toHaveBeenCalledWith(1, 2, { values: { name: '새 이름' }, clear: [], reason: '확인함' }));
  });
  it('does not revert on first click, confirms inline, refetches after completion', async () => {
    render(<MarketsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '테스트시장 · STREET' }));
    fireEvent.click(await screen.findByRole('button', { name: '되돌리기' }));
    expect(api.revertChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '되돌리기 확인' }));
    await waitFor(() => expect(api.revertChange).toHaveBeenCalledWith(1, 9));
    await waitFor(() => expect(api.getMarket).toHaveBeenCalledTimes(2));
  });
  it('shows a friendly stale revert conflict without dismissing the inline selection', async () => {
    vi.mocked(api.revertChange).mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
    render(<MarketsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '테스트시장 · STREET' }));
    fireEvent.click(await screen.findByRole('button', { name: '되돌리기' }));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기 확인' }));
    expect(await screen.findByText(/이후 변경과 충돌/)).toBeInTheDocument();
  });
});
