import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPlatformReleases, putPlatformRelease, type PlatformReleaseInput, type PlatformReleaseStatus, type PlatformAudience } from '../../api/games';

export function normalizeRobloxPlaceId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[1-9][0-9]{0,63}$/.test(value)) return value;
  const match = /^https:\/\/(?:www\.)?roblox\.com\/games\/([1-9][0-9]{0,63})(?:\/[A-Za-z0-9_-]+)?\/?$/.exec(value);
  if (!match) throw new Error('invalid Roblox game URL');
  return match[1];
}

const emptyRelease: PlatformReleaseInput = { platformRef: null, releaseStatus: 'DRAFT', audience: 'INVITE_ONLY' };
type PlatformDraft = { input: string; releaseStatus: PlatformReleaseStatus; audience: PlatformAudience };
const toDraft = (release: PlatformReleaseInput): PlatformDraft => ({ input: release.platformRef ?? '', releaseStatus: release.releaseStatus, audience: release.audience });

/** Keep a successful server snapshot separate from the editable preview and query retries. */
export function usePlatformReleaseDraft(slug: string) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin-game-platform-releases', slug], queryFn: () => fetchPlatformReleases(slug), refetchOnWindowFocus: false });
  const [edited, setEdited] = useState<PlatformDraft>();
  const server = query.data?.find((r) => r.platform === 'ROBLOX');
  const baseline = toDraft(server ?? emptyRelease);
  const draft = edited ?? baseline;
  const dirty = draft.input !== baseline.input || draft.releaseStatus !== baseline.releaseStatus || draft.audience !== baseline.audience;
  let id: string | null = null;
  let invalid = false;
  try { id = normalizeRobloxPlaceId(draft.input); } catch { invalid = true; }
  const valid = !invalid && (id !== null || (draft.releaseStatus !== 'BETA' && draft.releaseStatus !== 'RELEASED'));
  const ready = !!query.data && !query.isError;
  const save = async () => {
    const queryKey = ['admin-game-platform-releases', slug];
    // A stale GET must never replace a successful PUT snapshot (including reconnect refetches).
    await client.cancelQueries({ queryKey, exact: true });
    const release = await putPlatformRelease(slug, { platformRef: id, releaseStatus: draft.releaseStatus, audience: draft.audience });
    setEdited(toDraft(release));
    await client.cancelQueries({ queryKey, exact: true });
    client.setQueryData(queryKey, [release]);
  };
  return { query, server, draft, dirty, valid, invalid, id, ready, save, change: (next: Partial<PlatformDraft>) => setEdited({ ...draft, ...next }) };
}

