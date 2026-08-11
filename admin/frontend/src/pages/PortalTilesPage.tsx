import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  deleteTile,
  listTiles,
  upsertTile,
  type PortalTile,
  type TileStatus,
} from '@/api/portalTiles';

const STATUS_LABEL: Record<TileStatus, string> = {
  LIVE: '활성',
  SOON: '준비중',
  HIDDEN: '비노출',
};

const EMPTY_TILE = {
  id: null as number | null,
  code: '',
  label: '',
  tagline: '',
  href: '',
  status: 'SOON' as TileStatus,
  orderNo: 0,
};

/** 빈 문자열은 "값 없음"이다 */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function PortalTilesPage() {
  const [tiles, setTiles] = useState<PortalTile[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_TILE);

  const reload = useCallback(async () => {
    setTiles(await listTiles());
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch {
      setMessage('실패했습니다 — 코드는 소문자·숫자·하이픈만, 활성 타일에는 링크가 필요합니다');
    }
  };

  if (!tiles) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  const liveCount = tiles.filter((t) => t.status === 'LIVE').length;
  const soonCount = tiles.filter((t) => t.status === 'SOON').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">메인 타일</h1>
          <p className="text-sm text-zinc-500">
            1989v.com 메인의 도메인 진입점입니다. 서비스가 완성되면 준비중을 활성으로 바꾸세요.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-8">
          <Stat label="활성" value={`${liveCount}개`} />
          <Stat label="준비중" value={`${soonCount}개`} />
          <Stat label="비노출" value={`${tiles.length - liveCount - soonCount}개`} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          준비중 타일이 많으면 "진행 중인 게 많다"가 아니라 "끝맺은 게 없다"로 읽힙니다.
          실제 로드맵만 준비중으로 두고, 공개하지 않을 서비스는 비노출로 내리세요.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">타일</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3">순서</th>
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">코드</th>
                <th className="py-2 pr-3">설명</th>
                <th className="py-2 pr-3">링크</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {tiles.map((t) => (
                <tr
                  key={t.code}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    t.status === 'HIDDEN' ? 'text-zinc-400' : ''
                  }`}
                >
                  <td className="py-2 pr-3 tabular-nums text-zinc-500">{t.orderNo}</td>
                  <td className="py-2 pr-3 font-medium">{t.label}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{t.code}</td>
                  <td className="py-2 pr-3 text-zinc-500">{t.tagline ?? '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{t.href ?? '—'}</td>
                  <td className="py-2 pr-3">{STATUS_LABEL[t.status]}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setForm({
                        id: t.id,
                        code: t.code,
                        label: t.label,
                        tagline: t.tagline ?? '',
                        href: t.href ?? '',
                        status: t.status,
                        orderNo: t.orderNo,
                      })}
                    >
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => t.id && run(() => deleteTile(t.id!), '삭제했습니다')}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
              {tiles.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-zinc-500">아직 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="코드 (place)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              placeholder="이름 (한국 관광 검색)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="한 줄 설명 (선택)"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              className="sm:col-span-2"
              placeholder="링크 (/place · /shop · https://…)"
              value={form.href}
              onChange={(e) => setForm({ ...form, href: e.target.value })}
            />
            <select
              className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TileStatus })}
            >
              <option value="LIVE">활성</option>
              <option value="SOON">준비중 (딤드)</option>
              <option value="HIDDEN">비노출</option>
            </select>
            <Input
              type="number"
              value={form.orderNo}
              onChange={(e) => setForm({ ...form, orderNo: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => run(async () => {
                await upsertTile({
                  id: form.id ?? undefined,
                  code: form.code,
                  label: form.label,
                  tagline: blankToNull(form.tagline),
                  href: blankToNull(form.href),
                  status: form.status,
                  orderNo: form.orderNo,
                });
                setForm(EMPTY_TILE);
              }, '저장했습니다')}
            >
              저장
            </Button>
            <Button variant="ghost" onClick={() => setForm(EMPTY_TILE)}>초기화</Button>
            <span className="text-xs text-zinc-500">
              링크는 상대 경로를 권장합니다 — place/game 은 프로덕션에서 서브도메인으로 자동 이동합니다.
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
