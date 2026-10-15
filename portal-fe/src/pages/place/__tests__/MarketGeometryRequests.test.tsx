import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '../../../api/marketStewardApi';
import MarketGeometryRequests, { requestProjection } from '../MarketGeometryRequests';
vi.mock('../../../api/marketStewardApi', () => ({ listGeometryRequests: vi.fn(), submitGeometryRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const detail: api.MarketEditorDetail = { market: { id: 7, name: '시장' }, zones: [], stores: [{ source: {} as api.EditorStore['source'], display: { name: '가게', items: null, zoneId: null, membership: { status: 'IN' }, coordinate: { latitude: 37, longitude: 127 }, pinKind: 'EXACT' } }] };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MarketGeometryRequests detail={detail} /></QueryClientProvider>);
describe('geometry change proposals', () => {
  it('collects map coordinates and requires description before submission, then shows the market list', async () => {
    vi.mocked(api.listGeometryRequests).mockResolvedValue([{ id: 8, marketId: 7, kind: 'NOTE', geometry: null, description: '입구 확인', status: 'APPROVED', createdAt: '', decisionReason: '현장 확인' }]);
    vi.mocked(api.submitGeometryRequest).mockResolvedValue({ id: 9, status: 'PENDING' }); mount();
    expect(await screen.findByText('#8 · 위치 메모 · 승인 · 편집 반영 대기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경 요청 보내기' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('요청 종류'), { target: { value: 'NOTE' } });
    const map = screen.getByRole('img', { name: '변경 요청 지도' });
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 400 } as DOMRect);
    fireEvent.click(map, { clientX: 300, clientY: 200 });
    fireEvent.change(screen.getByLabelText('변경 설명 (필수)'), { target: { value: ' 새 입구 ' } });
    fireEvent.click(screen.getByRole('button', { name: '변경 요청 보내기' }));
    await waitFor(() => expect(api.submitGeometryRequest).toHaveBeenCalledWith(7, { kind: 'NOTE', geometry: [[37, 127]], description: '새 입구' }));
    expect(await screen.findByText('요청 #9을 보냈습니다.')).toBeInTheDocument();
  });
  it('blocks incomplete paths and replaces one-point notes; suspensions disable further submission', async () => {
    vi.mocked(api.listGeometryRequests).mockResolvedValue([]); vi.mocked(api.submitGeometryRequest).mockRejectedValue({ isAxiosError: true, response: { status: 403 } }); mount();
    fireEvent.change(screen.getByLabelText('요청 종류'), { target: { value: 'PATH' } });
    fireEvent.change(screen.getByLabelText('요청 지점 위도'), { target: { value: '37' } }); fireEvent.change(screen.getByLabelText('요청 지점 경도'), { target: { value: '127' } }); fireEvent.click(screen.getByRole('button', { name: '좌표로 지점 추가' }));
    fireEvent.change(screen.getByLabelText('변경 설명 (필수)'), { target: { value: '골목' } }); expect(screen.getByRole('button', { name: '변경 요청 보내기' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('요청 종류'), { target: { value: 'NOTE' } }); fireEvent.click(screen.getByRole('button', { name: '좌표로 지점 추가' })); fireEvent.click(screen.getByRole('button', { name: '좌표로 지점 추가' }));
    expect(screen.getByRole('list', { name: '요청 지점 목록' }).children).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '변경 요청 보내기' })); expect(await screen.findByText('이 시장 관리 권한이 없습니다.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: '변경 요청 보내기' })).toBeDisabled();
  });
  it('inverts its geographic projection without swapping lat/lng', () => { const p = requestProjection([{ latitude: 37, longitude: 127 }])!; const point: [number, number] = [37.0001, 127.0002]; const pixel = p.point(point); const roundtrip = p.coordinate(pixel[0], pixel[1]); expect(roundtrip[0]).toBeCloseTo(point[0], 8); expect(roundtrip[1]).toBeCloseTo(point[1], 8); });
});
