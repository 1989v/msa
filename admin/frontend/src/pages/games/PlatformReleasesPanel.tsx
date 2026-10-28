import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { fetchPlatformReleases, putPlatformRelease, type PlatformRelease, type PlatformReleaseStatus, type PlatformAudience } from '../../api/games';

export function normalizeRobloxPlaceId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[1-9][0-9]{0,63}$/.test(value)) return value;
  const match = /^https:\/\/(?:www\.)?roblox\.com\/games\/([1-9][0-9]{0,63})(?:\/[A-Za-z0-9_-]+)?\/?$/.exec(value);
  if (!match) throw new Error('invalid Roblox game URL');
  return match[1];
}

export default function PlatformReleasesPanel({ slug, playable }: { slug: string; playable: boolean }) {
  const query = useQuery({ queryKey: ['admin-game-platform-releases', slug], queryFn: () => fetchPlatformReleases(slug) });
  return <section onKeyDown={(event) => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault(); }} className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
    <h3 className="text-sm font-semibold">플랫폼 버전</h3>
    {query.isError ? <div role="alert">플랫폼 버전을 불러오지 못했습니다. <Button type="button" variant="outline" onClick={() => void query.refetch()}>다시 시도</Button></div> :
      query.data ? <PlatformReleaseEditor key={slug} slug={slug} initial={query.data.find((r) => r.platform === 'ROBLOX')} playable={playable} /> : <p>불러오는 중...</p>}
  </section>;
}

function PlatformReleaseEditor({ slug, initial, playable }: { slug: string; initial?: PlatformRelease; playable: boolean }) {
  const client = useQueryClient();
  const [input, setInput] = useState(initial?.platformRef ?? '');
  const [status, setStatus] = useState<PlatformReleaseStatus>(initial?.releaseStatus ?? 'DRAFT');
  const [audience, setAudience] = useState<PlatformAudience>(initial?.audience ?? 'INVITE_ONLY');
  const [saved, setSaved] = useState(false);
  let id: string | null = null;
  let invalid = false;
  try { id = normalizeRobloxPlaceId(input); } catch { invalid = true; }
  const valid = !invalid && (id !== null || (status !== 'BETA' && status !== 'RELEASED'));
  const visible = playable && !!id && audience === 'PUBLIC' && (status === 'BETA' || status === 'RELEASED');
  const mutation = useMutation({
    mutationFn: () => putPlatformRelease(slug, { platformRef: id, releaseStatus: status, audience }),
    onSuccess: (release) => {
      setInput(release.platformRef ?? ''); setSaved(true);
      void client.invalidateQueries({ queryKey: ['admin-game-platform-releases', slug] });
    },
  });
  const changed = () => setSaved(false);
  return <fieldset disabled={mutation.isPending} className="space-y-2">
    <p className="text-sm font-medium">Roblox</p>
    <label className="block text-xs" htmlFor="roblox-place">게임 주소 / 시작 Place ID</label>
    <Input id="roblox-place" value={input} onChange={(e) => { setInput(e.target.value); changed(); }} placeholder="https://www.roblox.com/games/…" />
    <p className="text-xs text-zinc-500">게시된 게임 페이지의 HTTPS 주소나 Place ID를 입력하세요. Universe ID·공유·인증·초대 주소는 사용할 수 없습니다.</p>
    {invalid && <p role="alert">올바른 Roblox 게임 주소 또는 양의 정수 Place ID를 입력하세요. 쿼리와 인증 정보는 제외하세요.</p>}
    {id && <p className="break-all text-xs">정규 주소: https://www.roblox.com/games/{id}</p>}
    <div className="grid grid-cols-2 gap-2">
      <div><label htmlFor="roblox-status" className="block text-xs">출시 상태</label><Select id="roblox-status" value={status} onChange={(e) => { setStatus(e.target.value as PlatformReleaseStatus); changed(); }}>
        <option value="DRAFT">초안</option><option value="BETA">베타</option><option value="RELEASED">정식</option><option value="DISABLED">중단</option>
      </Select></div>
      <div><label htmlFor="roblox-audience" className="block text-xs">접근 범위</label><Select id="roblox-audience" value={audience} onChange={(e) => { setAudience(e.target.value as PlatformAudience); changed(); }}>
        <option value="INVITE_ONLY">초대 전용</option><option value="PUBLIC">누구나</option>
      </Select></div>
    </div>
    <p className="text-xs">{visible ? '일반 방문자에게 표시됨' : '일반 방문자에게 표시되지 않음'}</p>
    <p className="text-xs text-zinc-500">다른 계정에서 실제 플레이 가능 여부를 확인한 후 누구나로 저장하세요. 플랫폼 버전은 아래 게임 저장과 별도로 저장됩니다.</p>
    <Button type="button" variant="outline" disabled={!valid || mutation.isPending} onClick={() => { setSaved(false); mutation.mutate(); }}>플랫폼 버전 저장</Button>
    {mutation.isError && <p role="alert">플랫폼 버전 저장에 실패했습니다. 입력을 확인하고 다시 시도하세요.</p>}
    {saved && <p role="status">플랫폼 버전을 저장했습니다.</p>}
  </fieldset>;
}
