import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  adsErrorMessage,
  archiveHouseCreative,
  changeHouseCampaignStatus,
  createHouseCampaign,
  createHouseCreative,
  listHouseCampaigns,
  listHouseCreatives,
  type AdminCreative,
  type CampaignAction,
  type HouseCampaign,
} from '@/api/ads';

const STATUS_LABEL: Record<HouseCampaign['status'], string> = {
  DRAFT: '초안',
  ACTIVE: '게재 중',
  PAUSED: '일시정지',
  ENDED: '종료',
};

const NEXT_ACTIONS: Record<HouseCampaign['status'], { action: CampaignAction; label: string }[]> = {
  DRAFT: [{ action: 'START', label: '시작' }],
  ACTIVE: [
    { action: 'PAUSE', label: '일시정지' },
    { action: 'END', label: '종료' },
  ],
  PAUSED: [
    { action: 'RESUME', label: '재개' },
    { action: 'END', label: '종료' },
  ],
  ENDED: [],
};

const EMPTY_CAMPAIGN = { name: '', startAt: '', endAt: '', placementKeys: 'game-list-banner', categoryCodes: '' };
const EMPTY_CREATIVE = { title: '', body: '', link: '/', emoji: '', image: null as File | null };

const splitKeys = (value: string) => value.split(',').map((v) => v.trim()).filter(Boolean);

/**
 * HOUSE(자체 홍보) (ADR-0098) — 소유자는 「1989v 하우스」. 예산·지갑·최저가·빈도·원장에서 면제되고
 * 광고주 API 로는 만들 수 없다. 소재 링크는 앱 안 경로(`/games`) 또는 https URL, 이미지는 선택.
 */
export function AdsHousePage() {
  const [campaigns, setCampaigns] = useState<HouseCampaign[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [creatives, setCreatives] = useState<AdminCreative[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [creativeForm, setCreativeForm] = useState(EMPTY_CREATIVE);

  const reload = useCallback(async () => {
    setCampaigns(await listHouseCampaigns());
  }, []);

  const reloadCreatives = useCallback(async (campaignId: number | null) => {
    setCreatives(campaignId == null ? [] : await listHouseCreatives(campaignId));
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  useEffect(() => {
    reloadCreatives(selected).catch(() => setMessage('소재를 불러오지 못했습니다'));
  }, [selected, reloadCreatives]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    try {
      await action();
      await reload();
      await reloadCreatives(selected);
      setMessage(ok);
    } catch (err) {
      setMessage(adsErrorMessage(err, '실패했습니다'));
    }
  };

  if (!campaigns) return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">HOUSE 광고</h1>
          <p className="text-sm text-zinc-500">유료 광고와 AdSense 가 없을 때 지면을 채우는 자체 홍보입니다.</p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">캠페인</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3 text-left">지면</th>
              <th className="p-3 text-left">기간</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className={`border-t border-zinc-800 ${selected === c.id ? 'bg-zinc-100 dark:bg-zinc-800/60' : ''}`}>
                <td className="p-3">
                  <button type="button" className="underline" onClick={() => setSelected(c.id)}>
                    {c.name}
                  </button>
                </td>
                <td className="p-3">
                  {STATUS_LABEL[c.status]}
                  {c.status === 'ACTIVE' && !c.inPeriod ? ' · 기간 밖' : ''}
                </td>
                <td className="p-3 font-mono text-xs">{c.placementKeys.join(', ')}</td>
                <td className="p-3 text-xs">
                  {c.startAt} ~ {c.endAt ?? '끝 없음'}
                </td>
                <td className="space-x-1 p-3 text-right">
                  {NEXT_ACTIONS[c.status].map(({ action, label }) => (
                    <Button key={action} size="sm" variant="outline" onClick={() => run(() => changeHouseCampaignStatus(c.id, action), '바꿨습니다')}>
                      {label}
                    </Button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">HOUSE 캠페인 만들기</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="이름" value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
          <Input
            type="datetime-local"
            aria-label="시작"
            value={campaignForm.startAt}
            onChange={(e) => setCampaignForm({ ...campaignForm, startAt: e.target.value })}
          />
          <Input
            type="datetime-local"
            aria-label="끝(선택)"
            value={campaignForm.endAt}
            onChange={(e) => setCampaignForm({ ...campaignForm, endAt: e.target.value })}
          />
          <Input
            placeholder="지면 키 (쉼표로)"
            value={campaignForm.placementKeys}
            onChange={(e) => setCampaignForm({ ...campaignForm, placementKeys: e.target.value })}
          />
          <Input
            placeholder="카테고리 코드 (쉼표로, 비우면 전체)"
            value={campaignForm.categoryCodes}
            onChange={(e) => setCampaignForm({ ...campaignForm, categoryCodes: e.target.value })}
          />
        </div>
        <Button
          size="sm"
          disabled={!campaignForm.name.trim() || !campaignForm.startAt}
          onClick={() =>
            run(
              () =>
                createHouseCampaign({
                  name: campaignForm.name.trim(),
                  startAt: `${campaignForm.startAt}:00`,
                  endAt: campaignForm.endAt ? `${campaignForm.endAt}:00` : null,
                  placementKeys: splitKeys(campaignForm.placementKeys),
                  categoryCodes: splitKeys(campaignForm.categoryCodes),
                }).then(() => setCampaignForm(EMPTY_CAMPAIGN)),
              '만들었습니다',
            )
          }
        >
          만들기
        </Button>
      </Card>

      {selected != null && (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">소재 — 캠페인 #{selected}</h2>
          <ul className="space-y-2 text-sm">
            {creatives
              .filter((cr) => cr.status !== 'ARCHIVED')
              .map((cr) => (
                <li key={cr.id} className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-2">
                  <span>{cr.emoji}</span>
                  <span className="font-semibold">{cr.title}</span>
                  <span className="text-zinc-500">{cr.body}</span>
                  <span className="font-mono text-xs text-zinc-500">{cr.link}</span>
                  <Button size="sm" variant="outline" onClick={() => run(() => archiveHouseCreative(cr.id), '보관했습니다')}>
                    보관
                  </Button>
                </li>
              ))}
          </ul>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="제목" value={creativeForm.title} onChange={(e) => setCreativeForm({ ...creativeForm, title: e.target.value })} />
            <Input placeholder="문구" value={creativeForm.body} onChange={(e) => setCreativeForm({ ...creativeForm, body: e.target.value })} />
            <Input
              placeholder="링크 (/games 또는 https://…)"
              value={creativeForm.link}
              onChange={(e) => setCreativeForm({ ...creativeForm, link: e.target.value })}
            />
            <Input placeholder="이모지(선택)" value={creativeForm.emoji} onChange={(e) => setCreativeForm({ ...creativeForm, emoji: e.target.value })} />
            <input
              type="file"
              accept="image/png,image/jpeg"
              aria-label="이미지(선택)"
              onChange={(e) => setCreativeForm({ ...creativeForm, image: e.target.files?.[0] ?? null })}
            />
          </div>
          <Button
            size="sm"
            disabled={!creativeForm.title.trim() || !creativeForm.body.trim()}
            onClick={() =>
              run(
                () => createHouseCreative(selected, creativeForm).then(() => setCreativeForm(EMPTY_CREATIVE)),
                '소재를 만들었습니다',
              )
            }
          >
            소재 추가
          </Button>
        </Card>
      )}
    </div>
  );
}
