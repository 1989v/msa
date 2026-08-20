import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  changeBlogProfileStatus,
  listBlogProfiles,
  type BlogProfile,
  type ProfileStatus,
} from '@/api/blog';

const STATUS_LABEL: Record<ProfileStatus, string> = {
  PENDING: '승인 대기',
  ACTIVE: '활성',
  SUSPENDED: '정지',
};

/**
 * 저자 관리 (ADR-0072 §2).
 *
 * **작성 권한의 진실이 이 표다.** 전역 역할(ROLE_*)이 아니라 여기 상태가 다음 요청부터
 * 즉시 먹는다 — JWT 클레임에 권한을 실었다면 토큰 만료까지 못 막았을 것이다.
 * 정지는 글쓰기뿐 아니라 댓글도 함께 막는다.
 */
export function BlogAuthorsPage() {
  const [profiles, setProfiles] = useState<BlogProfile[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setProfiles(await listBlogProfiles());
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch {
      setMessage('실패했습니다');
    }
  };

  if (!profiles) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  const pending = profiles.filter((p) => p.role === 'AUTHOR' && p.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">블로그 저자</h1>
          <p className="text-sm text-zinc-500">
            승인해야 글을 쓸 수 있습니다. 정지하면 글쓰기와 댓글이 함께 막힙니다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      {pending.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm">승인 대기 {pending.length}건</p>
          <ul className="space-y-1 text-sm">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>
                  {p.displayName} <span className="font-mono text-xs text-zinc-500">@{p.handle}</span>
                </span>
                <Button size="sm" onClick={() => run(() => changeBlogProfileStatus(p.id, 'ACTIVE'), '승인했습니다')}>
                  승인
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">표시명</th>
              <th className="p-3 text-left">핸들</th>
              <th className="p-3 text-left">역할</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3 text-left">글</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-t border-zinc-800">
                <td className="p-3">{profile.displayName}</td>
                <td className="p-3 font-mono text-xs text-zinc-500">
                  {profile.handle ? `@${profile.handle}` : '—'}
                </td>
                <td className="p-3">{profile.role === 'AUTHOR' ? '저자' : '독자'}</td>
                <td className="p-3">{STATUS_LABEL[profile.status]}</td>
                <td className="p-3">{profile.postCount}</td>
                <td className="space-x-1 p-3 text-right">
                  {profile.status !== 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(() => changeBlogProfileStatus(profile.id, 'ACTIVE'), '활성화했습니다')}
                    >
                      활성
                    </Button>
                  )}
                  {profile.status !== 'SUSPENDED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(() => changeBlogProfileStatus(profile.id, 'SUSPENDED'), '정지했습니다')}
                    >
                      정지
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
