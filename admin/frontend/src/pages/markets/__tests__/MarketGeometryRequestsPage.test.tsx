import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@/api/geometryRequests';
import { MarketGeometryRequestsPage } from '../../MarketGeometryRequestsPage';
vi.mock('@/api/geometryRequests', () => ({ listGeometryRequests: vi.fn(), decideGeometryRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const row: api.GeometryRequest = { id: 9, marketId: 7, kind: 'PATH', geometry: [[37, 127], [37.001, 127.001]], description: '새 골목', status: 'PENDING', createdAt: '2026-10-15T09:00:00', decisionReason: null };
describe('geometry request admin review', () => {
  it('defaults to pending, previews drawing and requires a reason and inline confirmation', async () => {
    vi.mocked(api.listGeometryRequests).mockResolvedValue([row]); vi.mocked(api.decideGeometryRequest).mockResolvedValue(); render(<MarketGeometryRequestsPage />);
    expect(await screen.findByText('새 골목')).toBeInTheDocument(); expect(api.listGeometryRequests).toHaveBeenCalledWith('PENDING'); expect(screen.getByRole('img', { name: '요청 #9 그림 · 북쪽이 위' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '승인' })); expect(api.decideGeometryRequest).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: '결정 확인' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('결정 사유 (필수)'), { target: { value: '현장 확인' } }); fireEvent.click(screen.getByRole('button', { name: '취소' })); expect(api.decideGeometryRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '반려' })); fireEvent.change(screen.getByLabelText('결정 사유 (필수)'), { target: { value: '주소 확인 필요' } }); fireEvent.click(screen.getByRole('button', { name: '결정 확인' }));
    await waitFor(() => expect(api.decideGeometryRequest).toHaveBeenCalledWith(9, 'REJECT', '주소 확인 필요'));
  });
  it('offers only editor link for approved requests and changes status filter', async () => {
    vi.mocked(api.listGeometryRequests).mockResolvedValue([{ ...row, status: 'APPROVED', decisionReason: '검토 완료' }]); render(<MarketGeometryRequestsPage />);
    expect(await screen.findByRole('link', { name: '요청 #9을 편집기로 가져오기' })).toHaveAttribute('href', '/admin/place/markets/7?geometryRequest=9'); expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('요청 상태'), { target: { value: 'APPROVED' } }); await waitFor(() => expect(api.listGeometryRequests).toHaveBeenCalledWith('APPROVED'));
  });
});
