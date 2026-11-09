import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { PlatformReleaseStatus, PlatformAudience } from '../../api/games';
import type { usePlatformReleaseDraft } from './usePlatformReleaseDraft';

export default function PlatformReleasesPanel({ state, playable }: { state: ReturnType<typeof usePlatformReleaseDraft>; playable: boolean }) {
  const { query, server, draft, dirty, invalid, valid, id, change } = state;
  const previewVisible = playable && !!id && draft.audience === 'PUBLIC' && (draft.releaseStatus === 'BETA' || draft.releaseStatus === 'RELEASED');
  return <section onKeyDown={(event) => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault(); }} className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
    <h3 className="text-sm font-semibold">플랫폼 버전 · Roblox</h3>
    {query.isError ? <div role="alert">플랫폼 버전을 불러오지 못했습니다. 전체 저장 전에 다시 불러오세요. <Button type="button" variant="outline" onClick={() => void query.refetch()}>다시 불러오기</Button></div> : !query.data ? <p role="status">플랫폼 버전 불러오는 중...</p> : null}
    {query.data && <div className="space-y-2">
      <label className="block text-xs" htmlFor="roblox-place">게임 주소 / 시작 Place ID</label>
      <Input id="roblox-place" value={draft.input} onChange={(e) => change({ input: e.target.value })} placeholder="https://www.roblox.com/games/…" />
      <p className="text-xs text-zinc-500">게시된 게임 페이지의 HTTPS 주소나 Place ID를 입력하세요. Universe ID·공유·인증·초대 주소는 사용할 수 없습니다.</p>
      {invalid && <p role="alert">올바른 Roblox 게임 주소 또는 양의 정수 Place ID를 입력하세요. 쿼리와 인증 정보는 제외하세요.</p>}
      {!invalid && !valid && <p role="alert">베타·정식 버전에는 시작 Place ID가 필요합니다.</p>}
      {id && <p className="break-all text-xs">정규 주소: https://www.roblox.com/games/{id}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div><label htmlFor="roblox-status" className="block text-xs">출시 상태</label><Select id="roblox-status" value={draft.releaseStatus} onChange={(e) => change({ releaseStatus: e.target.value as PlatformReleaseStatus })}>
          <option value="DRAFT">초안</option><option value="BETA">베타</option><option value="RELEASED">정식</option><option value="DISABLED">중단</option>
        </Select></div>
        <div><label htmlFor="roblox-audience" className="block text-xs">접근 범위</label><Select id="roblox-audience" value={draft.audience} onChange={(e) => change({ audience: e.target.value as PlatformAudience })}>
          <option value="INVITE_ONLY">초대 전용</option><option value="PUBLIC">누구나</option>
        </Select></div>
      </div>
      <p className="text-xs">저장된 공개 상태: {server?.visible && playable ? '일반 방문자에게 표시됨' : '일반 방문자에게 표시되지 않음'}</p>
      {server?.url && <p className="break-all text-xs">저장된 주소: {server.url}</p>}
      <p className="text-xs">입력 미리보기{dirty ? ' (아직 저장되지 않음)' : ''}: {valid ? previewVisible ? '공개 예정' : '비공개' : '입력 확인 필요'}</p>
      <p className="text-xs text-zinc-500">다른 계정에서 실제 플레이 가능 여부를 확인한 후 누구나로 저장하세요. 변경한 플랫폼 버전은 하단 저장으로 함께 저장합니다.</p>
    </div>}
  </section>;
}
