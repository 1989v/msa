import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PartyPage from '../PartyPage';
import { EMPTY_STATE } from '../partyRelay';
import { usePartyRoom } from '../usePartyRoom';
const api = vi.hoisted(() => ({ host: vi.fn(), join: vi.fn(), shareRoster: vi.fn(), claimName: vi.fn(), startRound: vi.fn(), leave: vi.fn() }));
vi.mock('../usePartyRoom', () => ({ usePartyRoom: vi.fn() }));
vi.mock('../../../api/gameApi', () => ({ getGameLang: () => 'ko', listGames: vi.fn().mockResolvedValue({ content: [] }), displayTitle: () => '' }));
vi.mock('../../../auth/auth', () => ({ getAccessToken: () => null }));
function page(path: string, invitationRoot = false) { return render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/" element={<PartyPage invitationRoot={invitationRoot} />} />
  <Route path="/party/:room" element={<PartyPage />} /><Route path="/en/party/:room" element={<PartyPage />} />
  <Route path="/party" element={<PartyPage />} />
</Routes></MemoryRouter>); }
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePartyRoom).mockReturnValue({ ...api, room: { ...EMPTY_STATE, connected: false, roster: { names: [], taken: {} }, occupied: [], cfg: null } });
});
describe('invitation page never silently becomes a host', () => {
  it.each(['/?r=', '/?r=ABC234&r=ABC234', '/party/INVALID', '/en/party/ABC123'])('blocks %s and allows corrected fresh join', async (path) => {
    page(path, true); expect(api.host).not.toHaveBeenCalled(); expect(api.join).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('초대 코드 형식');
    fireEvent.change(screen.getByLabelText('방 코드 또는 초대 링크'), { target: { value: 'abc-234' } });
    fireEvent.click(screen.getByRole('button', { name: '코드로 입장' }));
    await waitFor(() => expect(api.join).toHaveBeenCalledWith('ABC234'));
    expect(api.host).not.toHaveBeenCalled();
  });
  it.each(['/party/ABC234', '/en/party/ABC234', '/?r=ABC234'])('joins %s, supports same-code retry after unknown/closed room', async (path) => {
    const room = { ...EMPTY_STATE, error: '그 방이 없습니다. 코드를 다시 확인하거나 새 방을 여세요.', connected: true, roster: { names: [], taken: {} }, occupied: [], cfg: null };
    vi.mocked(usePartyRoom).mockReturnValue({ ...api, room });
    await act(async () => { page(path, true); }); expect(api.join).toHaveBeenCalledTimes(1); expect(api.host).not.toHaveBeenCalled();
    expect(screen.getByText(/그 방이 없습니다/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('방 코드 또는 초대 링크'), { target: { value: 'ABC234' } });
    fireEvent.click(screen.getByRole('button', { name: '코드로 입장' }));
    expect(api.join).toHaveBeenCalledTimes(2);
  });
  it('copies only after click and never reports failed clipboard as success', async () => {
    const copy = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    vi.mocked(usePartyRoom).mockReturnValue({ ...api, room: { ...EMPTY_STATE, room: 'ABC234', connected: true, roster: { names: [], taken: {} }, occupied: [], cfg: null } });
    page('/party'); expect(copy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    await screen.findByText(/복사가 막혀/); expect(screen.queryByText('복사됨')).toBeNull();
    expect(copy).toHaveBeenCalledWith(`${window.location.origin}/?r=ABC234`);
  });
});


it('StrictMode socket cleanup opens a fresh join on the second setup', async () => {
  await act(async () => { render(<StrictMode><MemoryRouter initialEntries={['/party/ABC234']}><Routes>
    <Route path="/party/:room" element={<PartyPage />} />
  </Routes></MemoryRouter></StrictMode>); });
  expect(api.join).toHaveBeenCalledTimes(2);
  expect(api.leave).toHaveBeenCalledTimes(1);
  expect(api.host).not.toHaveBeenCalled();
});
it('invalid invitations never consume a stale previous room start', async () => {
  localStorage.removeItem('kgd.party.v1');
  vi.mocked(usePartyRoom).mockReturnValue({ ...api, room: { ...EMPTY_STATE, room: 'ABC234', connected: true, roster: { names: [], taken: {} }, occupied: [], cfg: { game: 'marble-race', names: ['A', 'B'], mode: 'last' } } });
  await act(async () => { page('/?r=', true); });
  expect(screen.getByRole('alert')).toHaveTextContent('초대 코드 형식');
  expect(localStorage.getItem('kgd.party.v1')).toBeNull();
  expect(api.join).not.toHaveBeenCalled(); expect(api.host).not.toHaveBeenCalled();
});
