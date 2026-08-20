import { useState } from 'react';
import type { BlogCommentNode } from '../../api/blogApi';
import { formatDate } from './PostCard';

interface Props {
  comments: BlogCommentNode[];
  loggedIn: boolean;
  needsDisplayName: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { parentId: number | null; body: string; displayName?: string }) => void;
  onEdit: (id: number, body: string) => void;
  onDelete: (id: number) => void;
  onRequireLogin: () => void;
}

/**
 * 댓글 스레드 — 대댓글은 1단계까지 (ADR-0072).
 *
 * 삭제·숨김 댓글도 자리를 남긴다. 빼 버리면 대댓글이 부모를 잃고 대화의 맥락이 끊긴다.
 */
export default function CommentThread({
  comments,
  loggedIn,
  needsDisplayName,
  busy,
  error,
  onSubmit,
  onEdit,
  onDelete,
  onRequireLogin,
}: Props) {
  const [body, setBody] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');

  const total = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  const submitRoot = () => {
    if (!body.trim()) return;
    onSubmit({ parentId: null, body, displayName: needsDisplayName ? displayName : undefined });
    setBody('');
  };

  const renderNode = (comment: BlogCommentNode, isReply: boolean) => {
    const removed = comment.status !== 'VISIBLE';
    return (
      <div key={comment.id}>
        <article className={`blog-comment${isReply ? ' blog-comment--reply' : ''}`}>
          <div className="blog-comment__head">
            <span className="blog-comment__author">{comment.author.displayName}</span>
            <span className="kh-mono">{formatDate(comment.createdAt)}</span>
          </div>
          {editing === comment.id ? (
            <>
              <textarea
                className="blog-textarea"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
              <div className="blog-comment__tools">
                <button
                  type="button"
                  className="blog-linkbtn"
                  onClick={() => {
                    onEdit(comment.id, editBody);
                    setEditing(null);
                  }}
                >
                  저장
                </button>
                <button type="button" className="blog-linkbtn" onClick={() => setEditing(null)}>
                  취소
                </button>
              </div>
            </>
          ) : (
            <p className={`blog-comment__body${removed ? ' is-removed' : ''}`}>{comment.body}</p>
          )}
          {!removed && editing !== comment.id && (
            <div className="blog-comment__tools">
              {!isReply && (
                <button
                  type="button"
                  className="blog-linkbtn"
                  onClick={() => {
                    if (!loggedIn) return onRequireLogin();
                    setReplyTo(replyTo === comment.id ? null : comment.id);
                  }}
                >
                  답글
                </button>
              )}
              {comment.mine && (
                <>
                  <button
                    type="button"
                    className="blog-linkbtn"
                    onClick={() => {
                      setEditing(comment.id);
                      setEditBody(comment.body);
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="blog-linkbtn"
                    onClick={() => onDelete(comment.id)}
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          )}
        </article>
        {replyTo === comment.id && (
          <div className="blog-comment blog-comment--reply">
            <textarea
              className="blog-textarea"
              placeholder="답글을 남겨 주세요"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            <div className="blog-actions">
              <button
                type="button"
                className="blog-btn"
                disabled={busy || !replyBody.trim()}
                onClick={() => {
                  onSubmit({ parentId: comment.id, body: replyBody });
                  setReplyBody('');
                  setReplyTo(null);
                }}
              >
                답글 남기기
              </button>
            </div>
          </div>
        )}
        {comment.replies.map((reply) => renderNode(reply, true))}
      </div>
    );
  };

  return (
    <section className="blog-comments" aria-label="댓글">
      <h2 className="kh-section-label">댓글 {total}</h2>

      {loggedIn ? (
        <div className="blog-field">
          {needsDisplayName && (
            <input
              className="blog-input"
              placeholder="표시할 이름 (한 번만 정합니다)"
              value={displayName}
              maxLength={40}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <textarea
            className="blog-textarea"
            placeholder="댓글을 남겨 주세요"
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <p className="blog-error">{error}</p>}
          <div className="blog-actions">
            <button
              type="button"
              className="blog-btn"
              disabled={busy || !body.trim() || (needsDisplayName && !displayName.trim())}
              onClick={submitRoot}
            >
              등록
            </button>
          </div>
        </div>
      ) : (
        /* 좋아요·평점과 달리 댓글만 로그인을 요구한다 — 이유를 화면에서 밝혀 둔다 */
        <p className="blog-status">
          댓글은 로그인 후 남길 수 있습니다.{' '}
          <button type="button" className="blog-linkbtn" onClick={onRequireLogin}>
            로그인
          </button>
        </p>
      )}

      {comments.map((comment) => renderNode(comment, false))}
    </section>
  );
}
