import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '../../../api/marketStewardApi';
import * as auth from '../../../auth/auth';
import MarketStewardApplication from '../MarketStewardApplication';
vi.mock('../../../api/marketStewardApi', () => ({ currentSteward: vi.fn(), applySteward: vi.fn() }));
vi.mock('../../../auth/auth', () => ({ isLoggedIn: vi.fn(() => true), getUserId: vi.fn(() => '4'), buildLoginHref: () => 'https://1989v.com/login?next=place' }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.mocked(auth.isLoggedIn).mockReturnValue(true); });
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MarketStewardApplication marketId={7} lang="ko" /></QueryClientProvider>);
describe('application entry', () => {
  it('links guests to apex login and never fetches private state', () => { vi.mocked(auth.isLoggedIn).mockReturnValue(false); mount(); expect(screen.getByRole('link', { name: '상인회 담당자 신청' })).toHaveAttribute('href', 'https://1989v.com/login?next=place'); expect(api.currentSteward).not.toHaveBeenCalled(); });
  it('validates then submits trimmed organization and contact and shows pending', async () => {
    vi.mocked(api.currentSteward).mockResolvedValue(null); vi.mocked(api.applySteward).mockResolvedValue({ status: 'PENDING' } as api.Steward); mount();
    fireEvent.click(await screen.findByRole('button', { name: '담당자 신청하기' })); expect(screen.getByText('단체명을 입력하세요.')).toBeInTheDocument(); expect(api.applySteward).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('단체명 (필수)'), { target: { value: '상인회' } }); fireEvent.change(screen.getByLabelText('연락처 (필수)'), { target: { value: '010' } }); fireEvent.click(screen.getByRole('button', { name: '담당자 신청하기' }));
    await waitFor(() => expect(api.applySteward).toHaveBeenCalledWith(7, '상인회', '010')); expect(await screen.findByText('승인 대기')).toBeInTheDocument();
  });
  it.each([['PENDING', '승인 대기'], ['SUSPENDED', '정지됨 — 운영자 문의'], ['ACTIVE', '가게 정보 관리']] as const)('renders %s status without application fields', async (status, text) => { vi.mocked(api.currentSteward).mockResolvedValue({ status } as api.Steward); mount(); expect(await screen.findByText(text)).toBeInTheDocument(); expect(screen.queryByLabelText('단체명 (필수)')).not.toBeInTheDocument(); });
  it('keeps failed private lookup out of application form and offers retry', async () => { vi.mocked(api.currentSteward).mockRejectedValue(new Error('offline')); mount(); expect(await screen.findByRole('alert')).toHaveTextContent('불러오거나 저장하지 못했습니다'); expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument(); expect(screen.queryByLabelText('단체명 (필수)')).not.toBeInTheDocument(); });
});
