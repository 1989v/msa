import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  adsErrorMessage,
  deleteContextMapping,
  listContextMappings,
  listHostCategories,
  putContextMapping,
  putHostCategory,
  type ContextMapping,
  type HostCategory,
} from '@/api/ads';

/**
 * 문맥 매핑 (ADR-0098) — FE 가 보내는 문맥 키(`blog:backend`·`game:puzzle`·`place:11`)를 ads 카테고리로.
 * 매핑이 없는 키는 호스트 기본 카테고리로 간다. 바뀐 값은 1분 안에 결정에 반영된다.
 */
export function AdsContextMappingsPage() {
  const [mappings, setMappings] = useState<ContextMapping[] | null>(null);
  const [hosts, setHosts] = useState<HostCategory[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState({ contextKey: '', categoryCode: '' });
  const [hostForm, setHostForm] = useState({ host: '', categoryCode: '' });

  const reload = useCallback(async () => {
    const [m, h] = await Promise.all([listContextMappings(), listHostCategories()]);
    setMappings(m);
    setHosts(h);
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch (err) {
      setMessage(adsErrorMessage(err, '실패했습니다'));
    }
  };

  if (!mappings) return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">문맥 매핑</h1>
          <p className="text-sm text-zinc-500">문맥 키 → 카테고리. 매핑이 없으면 호스트 기본 카테고리를 씁니다.</p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">매핑 추가·변경</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-64"
            placeholder="문맥 키 (blog:backend)"
            value={mappingForm.contextKey}
            onChange={(e) => setMappingForm({ ...mappingForm, contextKey: e.target.value })}
          />
          <Input
            className="w-48"
            placeholder="카테고리 코드"
            value={mappingForm.categoryCode}
            onChange={(e) => setMappingForm({ ...mappingForm, categoryCode: e.target.value })}
          />
          <Button
            size="sm"
            onClick={() =>
              run(
                () =>
                  putContextMapping(mappingForm.contextKey.trim(), mappingForm.categoryCode.trim()).then(() =>
                    setMappingForm({ contextKey: '', categoryCode: '' }),
                  ),
                '저장했습니다',
              )
            }
          >
            저장
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">문맥 키</th>
              <th className="p-3 text-left">카테고리</th>
              <th className="p-3 text-left">바꾼 운영자 · 시각</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.contextKey} className="border-t border-zinc-800">
                <td className="p-3 font-mono text-xs">{m.contextKey}</td>
                <td className="p-3 font-mono text-xs">{m.categoryCode}</td>
                <td className="p-3 text-xs text-zinc-500">
                  {m.updatedBy != null ? `#${m.updatedBy}` : '시드'} · {m.updatedAt}
                </td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => run(() => deleteContextMapping(m.contextKey), '지웠습니다')}>
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">호스트 기본 카테고리</h2>
        <ul className="space-y-1 text-sm">
          {hosts.map((h) => (
            <li key={h.host} className="flex flex-wrap gap-3">
              <span className="font-mono text-xs">{h.host}</span>
              <span className="font-mono text-xs">{h.categoryCode}</span>
              <span className="text-xs text-zinc-500">
                {h.updatedBy != null ? `#${h.updatedBy}` : '시드'} · {h.updatedAt}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-64"
            placeholder="호스트 (blog.1989v.com)"
            value={hostForm.host}
            onChange={(e) => setHostForm({ ...hostForm, host: e.target.value })}
          />
          <Input
            className="w-48"
            placeholder="카테고리 코드"
            value={hostForm.categoryCode}
            onChange={(e) => setHostForm({ ...hostForm, categoryCode: e.target.value })}
          />
          <Button
            size="sm"
            onClick={() =>
              run(
                () =>
                  putHostCategory(hostForm.host.trim(), hostForm.categoryCode.trim()).then(() =>
                    setHostForm({ host: '', categoryCode: '' }),
                  ),
                '저장했습니다',
              )
            }
          >
            저장
          </Button>
        </div>
      </Card>
    </div>
  );
}
