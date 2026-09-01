import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  changeSuggestionStatus,
  listGameSuggestions,
  replyToSuggestion,
  SUGGESTION_STATUSES,
  type AdminGameSuggestion,
  type SuggestionStatus,
} from '@/api/games';

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  OPEN: '접수',
  REVIEWING: '검토중',
  APPLIED: '반영',
  DECLINED: '반려',
};

/**
 * 게임 개선 제안 처리 (ADR-0087).
 *
 * 본문은 고치지 못한다 — 쓴 사람만 고칠 수 있고, 반영·반려의 근거로 남은 문장이
 * 사후에 달라지면 안 된다. 여기서 하는 일은 상태를 옮기고 답글을 다는 것이다.
 *
 * 상태 전이를 한 방향으로 잠그지 않는다: 상태를 바꾸는 손이 하나뿐이라 오조작을
 * 되돌릴 다른 경로가 없다.
 */
export function GameSuggestionsPage() {
  const [items, setItems] = useState<AdminGameSuggestion[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | ''>('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const page = await listGameSuggestions({ status: statusFilter || undefined, size: 50 });
    setItems(page.content);
  }, [statusFilter]);

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

  if (!items) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">게임 개선 제안</h1>
          <p className="text-sm text-zinc-500">
            본문은 쓴 사람만 고칠 수 있습니다. 여기서는 상태를 옮기고 답글을 답니다 — 둘 다 전체 공개입니다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">상태</span>
        <select
          className="rounded border border-zinc-700 bg-transparent p-1"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SuggestionStatus | '')}
        >
          <option value="">전체</option>
          {SUGGESTION_STATUSES.map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
        </select>
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">게임</th>
              <th className="p-3 text-left">작성자</th>
              <th className="p-3 text-left">내용 · 답글</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-800 align-top">
                <td className="p-3">
                  <a
                    href={`https://1989v.com/games/${item.gameSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {item.gameTitle}
                  </a>
                </td>
                <td className="p-3">{item.nickname}</td>
                <td className="max-w-md p-3">
                  <p className="whitespace-pre-wrap text-zinc-300">{item.body}</p>
                  {item.replies.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l border-zinc-700 pl-3 text-xs text-zinc-400">
                      {item.replies.map((reply) => (
                        <li key={reply.id}>
                          <span className="font-medium text-zinc-300">
                            {reply.authorType === 'OPERATOR' ? '운영자' : reply.authorName}
                          </span>
                          {' · '}
                          <span className="whitespace-pre-wrap">{reply.body}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {replyingTo === item.id && (
                    <div className="mt-2 space-y-1">
                      <textarea
                        aria-label="답글"
                        rows={2}
                        maxLength={1000}
                        className="w-full rounded border border-zinc-700 bg-transparent p-2"
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                      />
                      <div className="space-x-1">
                        <Button
                          size="sm"
                          disabled={replyBody.trim().length === 0}
                          onClick={() =>
                            run(async () => {
                              await replyToSuggestion(item.gameSlug, item.id, replyBody);
                              setReplyingTo(null);
                              setReplyBody('');
                            }, '답글을 달았습니다')
                          }
                        >
                          등록
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                          취소
                        </Button>
                      </div>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <select
                    aria-label={`${item.gameTitle} 처리 상태`}
                    className="rounded border border-zinc-700 bg-transparent p-1"
                    value={item.status}
                    onChange={(e) =>
                      run(
                        () => changeSuggestionStatus(item.id, e.target.value as SuggestionStatus),
                        '상태를 바꿨습니다',
                      )
                    }
                  >
                    {SUGGESTION_STATUSES.map((status) => (
                      <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                    ))}
                  </select>
                </td>
                <td className="space-x-1 p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(item.id);
                      setReplyBody('');
                    }}
                  >
                    답글
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="p-6 text-sm text-zinc-500">해당 상태의 제안이 없습니다.</p>
        )}
      </Card>
    </div>
  );
}
