import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  grantPrivateGameAccess,
  listPrivateGameMembers,
  revokePrivateGameAccess,
  type PrivateGameMember,
} from '@/api/games';

/**
 * 비밀 게임 허용 명단.
 *
 * **카탈로그에서 빼는 것만으로는 안 막힌다** — 게임 파일은 nginx 가 정적으로 그대로
 * 내주므로, 목록에 없어도 주소를 아는 사람은 받아 갈 수 있다. 여기 명단에 있는 회원만
 * ingress 관문(`auth-url`)을 통과한다.
 *
 * **회원 번호로 넣는다.** 이 플랫폼은 소셜에서 이메일·실명을 받지 않아(ADR-0078) 사람을
 * 가리킬 수 있는 것이 회원 번호뿐이다 — 누구인지는 메모로 적어 둔다.
 */
export function PrivateGamesPage() {
  const [slug, setSlug] = useState('deep-night');
  const [members, setMembers] = useState<PrivateGameMember[] | null>(null);
  const [memberId, setMemberId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!slug.trim()) return;
    setMembers(await listPrivateGameMembers(slug.trim()));
  }, [slug]);

  useEffect(() => {
    reload().catch(() => setMessage('명단을 불러오지 못했습니다'));
  }, [reload]);

  const add = async () => {
    const id = Number(memberId);
    if (!Number.isInteger(id) || id <= 0) {
      setMessage('회원 번호는 1 이상의 정수입니다');
      return;
    }
    try {
      await grantPrivateGameAccess(slug.trim(), id, note.trim() || undefined);
      setMemberId('');
      setNote('');
      await reload();
      setMessage(`회원 ${id} 를 허용했습니다`);
    } catch {
      setMessage('추가하지 못했습니다');
    }
  };

  const remove = async (id: number) => {
    try {
      await revokePrivateGameAccess(slug.trim(), id);
      await reload();
      setMessage(`회원 ${id} 의 접근을 막았습니다`);
    } catch {
      setMessage('삭제하지 못했습니다');
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">비밀 게임 접근 권한</h1>
        <p className="text-sm text-zinc-500">
          목록에 없는 게임을 열어 줄 회원을 지정합니다. 여기 없는 계정은 주소를 알아도
          게임 파일을 받지 못합니다.
        </p>
      </header>

      <Card className="space-y-4 p-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">게임 슬러그</span>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="deep-night"
          />
          <span className="text-xs text-zinc-500">
            주소의 `/games/&lt;슬러그&gt;/` 와 같은 값입니다. 카탈로그에 없는 게임이라 목록에서
            고를 수 없습니다.
          </span>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">회원 번호</span>
            <input
              className="w-32 rounded border px-3 py-2 text-sm"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="1234"
              inputMode="numeric"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-sm font-medium">메모</span>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="누구인지 알아볼 수 있게 (판정에는 쓰지 않습니다)"
              maxLength={200}
            />
          </label>
          <Button onClick={add}>허용</Button>
        </div>
      </Card>

      {message && <p className="text-sm text-zinc-600">{message}</p>}

      <Card className="p-4">
        {members === null ? (
          <p className="text-sm text-zinc-500">불러오는 중…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-zinc-500">
            허용된 회원이 없습니다 — 지금은 아무도 이 게임에 들어갈 수 없습니다.
          </p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.memberId} className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">회원 {m.memberId}</p>
                  <p className="text-xs text-zinc-500">
                    {m.note || '메모 없음'} · {new Date(m.createdAt).toLocaleString('ko-KR')}
                  </p>
                </div>
                <Button variant="outline" onClick={() => remove(m.memberId)}>
                  막기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
