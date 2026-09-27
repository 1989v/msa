import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROFILE_CHANGED, PROFILE_OPEN, PROFILE_REVISION, gameProfileError, profileOwner, refreshGameProfile, saveGameProfile, useGameProfile } from './profileStore';
import './GameProfileHost.css';

function gameFrames(): HTMLIFrameElement[] {
  return [...document.querySelectorAll<HTMLIFrameElement>('iframe[src]')].filter((frame) => {
    try { const url = new URL(frame.src, location.href); return url.origin === location.origin && url.pathname.startsWith('/games/'); }
    catch { return false; }
  });
}
function notifyFrames() {
  gameFrames().forEach((frame) => frame.contentWindow?.postMessage({ type: 'game:profile:changed' }, location.origin));
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const state = useGameProfile();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const owner = useRef(state.owner);
  useEffect(() => {
    setDraft(state.profile?.nickname ?? '');
    setError(null);
  }, [state.profile?.nickname, state.owner]);
  useEffect(() => {
    alive.current = true;
    const restore = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const targets = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? [])];
      const first = targets[0], last = targets.at(-1);
      if (!first) { event.preventDefault(); panel.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => {
      alive.current = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', key);
      if (restore?.isConnected) restore.focus();
    };
  }, [onClose]);
  async function submit() {
    if (busyRef.current) return;
    const normalized = draft.normalize('NFKC').trim();
    if ([...normalized].length < 2 || [...normalized].length > 16 || !/^[\p{L}\p{N} ._-]+$/u.test(normalized)) {
      setError('2~16자의 문자, 숫자, 공백, 마침표, 밑줄, 하이픈을 사용해 주세요.'); return;
    }
    busyRef.current = true; setBusy(true); setError(null);
    const submittedOwner = profileOwner();
    try {
      await saveGameProfile(normalized);
      if (alive.current && submittedOwner === profileOwner()) onClose();
    } catch (failure) {
      if (alive.current && submittedOwner === profileOwner()) setError(gameProfileError(failure));
    } finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => { if (owner.current !== state.owner) onClose(); }, [state.owner, onClose]);
  return createPortal(
    <div className="game-profile-veil" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="game-profile-dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby="game-profile-heading" tabIndex={-1}>
        <h2 id="game-profile-heading">게임 닉네임</h2>
        <p id="game-profile-help">모든 게임에서 같은 이름을 사용합니다. 다른 계정과 중복되는 이름은 사용할 수 없습니다.</p>
        {state.owner === 'guest'
          ? <p>게스트 계정입니다. 브라우저 쿠키를 삭제하면 이 닉네임과 기록을 복구할 수 없습니다.</p>
          : !state.profile && <p>회원 닉네임이 없으면 저장할 때 이 브라우저의 게스트 프로필과 기록을 회원 계정으로 가져옵니다. 기존 회원 프로필이 있으면 회원 기록을 사용하며 게스트 기록은 합치지 않습니다.</p>}
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label htmlFor="game-profile-nickname">닉네임</label>
          <input ref={input} id="game-profile-nickname" aria-describedby="game-profile-help" autoComplete="off" value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} />
          {state.status === 'loading' && <p role="status">프로필을 확인하고 있습니다.</p>}
          {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={() => void refreshGameProfile()}>다시 불러오기</button></p>}
          {error && <p role="alert">{error}</p>}
          <div className="game-profile-actions">
            <button type="button" onClick={onClose}>닫기</button>
            <button type="submit" disabled={busy || state.status !== 'ready'}>{busy ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </div>
    </div>, document.body,
  );
}

export default function GameProfileHost() {
  const [open, setOpen] = useState(false);
  const state = useGameProfile();
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    let alive = true;
    const show = async () => {
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch { return false; }
        if (document.fullscreenElement) return false;
      }
      if (!alive) return false;
      setOpen(true); void refreshGameProfile(); return true;
    };
    const openEvent = () => { void show(); };
    const changed = () => { void refreshGameProfile(true); notifyFrames(); };
    const focus = () => { void refreshGameProfile(true); };
    const storage = (event: StorageEvent) => { if (event.key === PROFILE_REVISION || event.key === 'portal_auth_revision') changed(); };
    const visibility = () => { if (document.visibilityState === 'visible') focus(); };
    const message = async (event: MessageEvent) => {
      if (event.origin !== location.origin || !gameFrames().some((frame) => frame.contentWindow === event.source)) return;
      if (event.data?.type === 'game:profile:changed') { changed(); return; }
      if (event.data?.type !== 'game:profile:open' || typeof event.data.requestId !== 'string') return;
      if (await show()) (event.source as Window).postMessage({ type: 'game:profile:ack', requestId: event.data.requestId }, event.origin);
    };
    window.addEventListener(PROFILE_OPEN, openEvent);
    window.addEventListener(PROFILE_CHANGED, changed);
    window.addEventListener('portal-auth-changed', changed);
    window.addEventListener('focus', focus);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('message', message);
    return () => {
      alive = false;
      window.removeEventListener(PROFILE_OPEN, openEvent);
      window.removeEventListener(PROFILE_CHANGED, changed);
      window.removeEventListener('portal-auth-changed', changed);
      window.removeEventListener('focus', focus);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('message', message);
    };
  }, []);
  useEffect(() => { notifyFrames(); }, [state.owner, state.revision]);
  return open ? <ProfileDialog onClose={close} /> : null;
}
