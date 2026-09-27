import { useEffect, useSyncExternalStore } from 'react';
import { getUserId } from '../auth/auth';
import { fetchGameProfile, updateGameProfile, type GamePlayerProfile } from '../api/gameProfileApi';

export const PROFILE_CHANGED = 'game-profile-changed';
export const PROFILE_REVISION = 'game_profile_revision';
export const PROFILE_OPEN = 'game-profile-open';
export type ProfileState = {
  owner: string; status: 'idle' | 'loading' | 'ready' | 'error';
  profile: GamePlayerProfile | null; error: string | null; revision: number;
};
export function profileOwner(): string { return getUserId() ? `member:${getUserId()}` : 'guest'; }
let state: ProfileState = { owner: profileOwner(), status: 'idle', profile: null, error: null, revision: 0 };
let generation = 0;
let inflight: Promise<void> | null = null;
let pendingSave: { owner: string; request: number } | null = null;
const listeners = new Set<() => void>();
function emit(next: ProfileState) { state = next; listeners.forEach((listener) => listener()); }
export function gameProfileError(error: unknown): string {
  return (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
    ?? (error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.');
}
function syncOwner() {
  const owner = profileOwner();
  if (state.owner !== owner) {
    generation++;
    inflight = null;
    pendingSave = null;
    emit({ owner, status: 'idle', profile: null, error: null, revision: state.revision + 1 });
  }
  return owner;
}
export function refreshGameProfile(force = false): Promise<void> {
  const owner = syncOwner();
  if (pendingSave?.owner === owner) return Promise.resolve();
  if (inflight && !force) return inflight;
  const request = ++generation;
  emit({ ...state, status: 'loading', error: null });
  inflight = fetchGameProfile().then((profile) => {
    if (request !== generation || owner !== profileOwner()) return;
    const changed = state.profile?.playerId !== profile?.playerId || state.profile?.nickname !== profile?.nickname;
    emit({ owner, status: 'ready', profile, error: null, revision: state.revision + Number(changed) });
  }).catch((error: unknown) => {
    if (request !== generation || owner !== profileOwner()) return;
    emit({ ...state, status: 'error', profile: null, error: gameProfileError(error) });
  }).finally(() => { if (request === generation) inflight = null; });
  return inflight;
}
export async function saveGameProfile(nickname: string): Promise<GamePlayerProfile> {
  const owner = syncOwner();
  const request = ++generation;
  inflight = null;
  pendingSave = { owner, request };
  try {
    const profile = await updateGameProfile(nickname);
    if (owner !== profileOwner() || request !== generation) throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');
    emit({ owner, status: 'ready', profile, error: null, revision: state.revision + 1 });
    try { localStorage.setItem(PROFILE_REVISION, `${Date.now()}-${Math.random()}`); } catch { /* storage is optional */ }
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED));
    return profile;
  } finally { if (pendingSave?.request === request) pendingSave = null; }

}
export function openGameProfile() { window.dispatchEvent(new CustomEvent(PROFILE_OPEN)); }
export function useGameProfile() {
  const snapshot = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => state);
  useEffect(() => { if (state.status === 'idle' || state.owner !== profileOwner()) void refreshGameProfile(); }, []);
  // Ownership must never come from a persisted display name or stale server response.
  return snapshot.owner === profileOwner() ? snapshot : { ...snapshot, profile: null, status: 'loading' as const };
}
