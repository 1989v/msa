import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  changeBlogCommentStatus,
  listBlogComments,
  type BlogCommentAdmin,
  type CommentStatus,
} from '@/api/blog';

const STATUS_LABEL: Record<CommentStatus, string> = {
  VISIBLE: '노출',
  HIDDEN: '숨김',
  DELETED: '삭제됨',
};

/**
 * 댓글 모더레이션 (ADR-0072).
 *
 * 삭제(작성자)와 숨김(모더레이션)을 구분한다 — 숨김은 되돌릴 수 있고, 삭제는 작성자의
 * 의사라 되돌리지 않는다. 어느 쪽이든 행은 남는다(대댓글이 부모를 잃지 않게).
 */
export function BlogCommentsPage() {
  const [comments, setComments] = useState<BlogCommentAdmin[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<CommentStatus | ''>('');
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const page = await listBlogComments({ status: statusFilter || undefined, size: 50 });
    setComments(page.items);
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

  if (!comments) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">블로그 댓글</h1>
          <p className="text-sm text-zinc-500">숨김은 되돌릴 수 있습니다. 작성자가 지운 댓글은 그대로 둡니다.</p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">상태</span>
        <select
          className="rounded border border-zinc-700 bg-transparent p-1"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CommentStatus | '')}
        >
          <option value="">전체</option>
          <option value="VISIBLE">노출</option>
          <option value="HIDDEN">숨김</option>
          <option value="DELETED">삭제됨</option>
        </select>
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">글</th>
              <th className="p-3 text-left">작성자</th>
              <th className="p-3 text-left">내용</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.id} className="border-t border-zinc-800 align-top">
                <td className="p-3">
                  <a
                    href={`https://blog.1989v.com/posts/${comment.postSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {comment.postTitle}
                  </a>
                </td>
                <td className="p-3">{comment.author.displayName}</td>
                <td className="max-w-md whitespace-pre-wrap p-3 text-zinc-300">{comment.body}</td>
                <td className="p-3">{STATUS_LABEL[comment.status]}</td>
                <td className="space-x-1 p-3 text-right">
                  {comment.status === 'VISIBLE' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(() => changeBlogCommentStatus(comment.id, 'HIDDEN'), '숨겼습니다')}
                    >
                      숨김
                    </Button>
                  ) : (
                    comment.status === 'HIDDEN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(() => changeBlogCommentStatus(comment.id, 'VISIBLE'), '복구했습니다')}
                      >
                        복구
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
            {comments.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-zinc-500">
                  댓글이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
