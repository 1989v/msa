import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GameProfileHost from '../GameProfileHost';
import { openGameProfile, refreshGameProfile, saveGameProfile, useGameProfile } from '../profileStore';
vi.mock('../profileStore', () => ({
  PROFILE_CHANGED: 'game-profile-changed', PROFILE_OPEN: 'game-profile-open', PROFILE_REVISION: 'game_profile_revision',
  useGameProfile: vi.fn(), refreshGameProfile: vi.fn(async () => undefined), saveGameProfile: vi.fn(),
  profileOwner: () => 'guest', gameProfileError: (error: Error) => error.message,
  openGameProfile: () => window.dispatchEvent(new CustomEvent('game-profile-open')),
}));
const ready = { owner: 'guest', status: 'ready' as const, profile: null, error: null, revision: 0 };
function open() { act(() => openGameProfile()); }
function frameMessage(frame: HTMLIFrameElement, origin: string, type: string) {
  return new MessageEvent('message', { source: frame.contentWindow, origin, data: { type, requestId: 'request-1' } });
}

describe('global game nickname modal', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(useGameProfile).mockReturnValue(ready); });

  it('traps Tab, closes with Escape and restores the trigger focus', async () => {
    render(<><button onClick={openGameProfile}>열기</button><GameProfileHost /></>);
    const trigger = screen.getByText('열기');
    trigger.focus(); fireEvent.click(trigger);
    const input = await screen.findByLabelText('닉네임');
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: '저장' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('normalizes the nickname, blocks duplicate submit and keeps duplicate errors visible', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(saveGameProfile).mockReturnValue(new Promise((_done, fail) => { reject = fail; }));
    render(<GameProfileHost />); open();
    fireEvent.change(await screen.findByLabelText('닉네임'), { target: { value: '  ＡＢ  ' } });
    const form = screen.getByRole('button', { name: '저장' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(saveGameProfile).toHaveBeenCalledTimes(1);
    expect(saveGameProfile).toHaveBeenCalledWith('AB');
    await act(async () => reject(new Error('이미 사용 중인 닉네임입니다.')));
    expect(screen.getByRole('alert')).toHaveTextContent('이미 사용 중');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows server failure separately from unset and disables save until retry succeeds', async () => {
    vi.mocked(useGameProfile).mockReturnValue({ ...ready, status: 'error', error: '서버 오류' });
    render(<GameProfileHost />); open();
    expect(await screen.findByRole('alert')).toHaveTextContent('서버 오류');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.click(screen.getByText('다시 불러오기'));
    expect(refreshGameProfile).toHaveBeenCalled();
  });

  it('accepts only a same-origin game frame and acknowledges its request', async () => {
    const frame = document.createElement('iframe'); frame.src = '/games/demo/index.html'; document.body.append(frame);
    const other = document.createElement('iframe'); other.src = '/other'; document.body.append(other);
    const ack = vi.spyOn(frame.contentWindow!, 'postMessage');
    render(<GameProfileHost />); ack.mockClear();
    await act(async () => window.dispatchEvent(frameMessage(frame, 'https://evil.example', 'game:profile:open')));
    await act(async () => window.dispatchEvent(frameMessage(other, location.origin, 'game:profile:open')));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => window.dispatchEvent(frameMessage(frame, location.origin, 'game:profile:open')));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(ack).toHaveBeenCalledWith({ type: 'game:profile:ack', requestId: 'request-1' }, location.origin);
    frame.remove(); other.remove();
  });

  it('exits fullscreen before opening, withholding ACK if exit fails for standalone fallback', async () => {
    const frame = document.createElement('iframe'); frame.src = '/games/demo/index.html'; document.body.append(frame);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: frame });
    const exit = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    const ack = vi.spyOn(frame.contentWindow!, 'postMessage');
    render(<GameProfileHost />); ack.mockClear();
    await act(async () => window.dispatchEvent(frameMessage(frame, location.origin, 'game:profile:open')));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ack).not.toHaveBeenCalled();
    exit.mockImplementation(async () => { Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null }); });
    await act(async () => window.dispatchEvent(frameMessage(frame, location.origin, 'game:profile:open')));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(ack).toHaveBeenCalledWith({ type: 'game:profile:ack', requestId: 'request-1' }, location.origin);
    frame.remove();
  });

  it('refreshes on cross-tab changes and window focus', async () => {
    render(<GameProfileHost />);
    window.dispatchEvent(new StorageEvent('storage', { key: 'game_profile_revision', newValue: '2' }));
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(refreshGameProfile).toHaveBeenCalledTimes(2));
  });
});
