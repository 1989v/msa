import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  applyAsAuthor,
  archivePost,
  blogErrorMessage,
  deletePost,
  fetchMyPosts,
  fetchStudioOverview,
  publishPost,
  updateMyProfile,
} from '../../api/blogApi';
import { LOGIN_NEXT_KEY } from '../../auth/auth';
import { useAuth } from '../../auth/useAuth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { blogPrivateMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import BlogShell from './BlogShell';
import { formatDate } from './PostCard';
import './Blog.css';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PUBLISHED: '발행됨',
  ARCHIVED: '보관됨',
};

/**
 * 작성자 스튜디오 (ADR-0072 §7).
 *
 * 어드민 콘솔과 달리 **자기 글만** 보인다. 목록 자체가 서버에서 좁혀져 오므로 화면이
 * 거르지 않는다. 저자가 아니면 신청 폼이 뜬다 — 등록제라 신청과 승인이 실제 관문이다.
 */
export default function BlogStudioPage() {
  useHeritageSurface();
  useSeo(blogPrivateMeta('내 스튜디오'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();

  const overview = useQuery({
    queryKey: ['blog', 'me', 'overview'],
    queryFn: fetchStudioOverview,
    enabled: isLoggedIn,
  });
  const posts = useQuery({
    queryKey: ['blog', 'me', 'posts'],
    queryFn: () => fetchMyPosts({ size: 50 }),
    enabled: isLoggedIn && (overview.data?.canWrite ?? false),
  });

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const profile = overview.data?.profile;
    if (!profile) return;
    setDisplayName((prev) => prev || profile.displayName);
    setBio((prev) => prev || profile.bio || '');
    setHandle((prev) => prev || profile.handle || '');
  }, [overview.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blog', 'me'] });
  };

  const applyMutation = useMutation({
    mutationFn: () => applyAsAuthor({ handle: handle.trim().toLowerCase(), displayName, bio: bio || null }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(blogErrorMessage(err, '저자 신청에 실패했습니다.')),
  });
  const profileMutation = useMutation({
    mutationFn: () => updateMyProfile({ displayName, bio: bio || null, avatarUrl: null }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(blogErrorMessage(err, '프로필을 저장하지 못했습니다.')),
  });
  const publishMutation = useMutation({
    mutationFn: publishPost,
    onSuccess: invalidate,
    onError: (err) => setError(blogErrorMessage(err, '발행하지 못했습니다.')),
  });
  const archiveMutation = useMutation({
    mutationFn: archivePost,
    onSuccess: invalidate,
    onError: (err) => setError(blogErrorMessage(err, '보관하지 못했습니다.')),
  });
  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: invalidate,
    onError: (err) => setError(blogErrorMessage(err, '삭제하지 못했습니다.')),
  });

  if (!isLoggedIn) {
    return (
      <BlogShell title="내 스튜디오">
        <main className="blog-form">
          <p className="blog-status">글을 쓰려면 로그인이 필요합니다.</p>
          <button
            type="button"
            className="blog-btn"
            onClick={() => {
              sessionStorage.setItem(LOGIN_NEXT_KEY, '/studio');
              navigate('/login');
            }}
          >
            로그인
          </button>
        </main>
      </BlogShell>
    );
  }

  const profile = overview.data?.profile;
  const canWrite = overview.data?.canWrite ?? false;
  const pending = profile?.role === 'AUTHOR' && profile.status === 'PENDING';
  const suspended = profile?.status === 'SUSPENDED';

  return (
    <BlogShell title="내 스튜디오">
      <main className="blog-form blog-form--wide">
        {overview.isLoading && <p className="blog-status">불러오는 중…</p>}
        {error && <p className="blog-error">{error}</p>}

        {canWrite && (
          <>
            <div className="blog-stats">
              <div>
                <div className="blog-stat__value">{overview.data?.publishedCount ?? 0}</div>
                <div className="blog-stat__label">발행</div>
              </div>
              <div>
                <div className="blog-stat__value">{overview.data?.draftCount ?? 0}</div>
                <div className="blog-stat__label">초안</div>
              </div>
              <div>
                <div className="blog-stat__value">{overview.data?.totalViews ?? 0}</div>
                <div className="blog-stat__label">누적 조회</div>
              </div>
            </div>

            <div className="blog-actions">
              <Link className="blog-btn" to="/studio/write">
                새 글 쓰기
              </Link>
              {profile?.handle && (
                <Link className="blog-btn blog-btn--ghost" to={`/authors/${profile.handle}`}>
                  내 공간 보기
                </Link>
              )}
            </div>

            {/* 5열 표는 모바일 폭에 안 들어간다 — 지면이 아니라 표가 스크롤한다 */}
            <div className="blog-table-scroll">
              <table className="blog-table">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>상태</th>
                    <th>발행일</th>
                    <th>조회</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(posts.data?.items ?? []).map((post) => (
                    <tr key={post.id}>
                      <td>
                        <Link to={`/studio/edit/${post.id}`}>{post.title}</Link>
                      </td>
                      <td className="kh-mono">{STATUS_LABEL[post.status] ?? post.status}</td>
                      <td className="kh-mono">{formatDate(post.publishedAt)}</td>
                      <td className="kh-mono">{post.viewCount}</td>
                      <td>
                        <div className="blog-comment__tools">
                          {post.status !== 'PUBLISHED' && (
                            <button
                              type="button"
                              className="blog-linkbtn"
                              onClick={() => publishMutation.mutate(post.id)}
                            >
                              발행
                            </button>
                          )}
                          {post.status === 'PUBLISHED' && (
                            <button
                              type="button"
                              className="blog-linkbtn"
                              onClick={() => archiveMutation.mutate(post.id)}
                            >
                              내리기
                            </button>
                          )}
                          <button
                            type="button"
                            className="blog-linkbtn"
                            onClick={() => {
                              if (window.confirm('삭제하면 댓글과 반응도 함께 사라집니다. 계속할까요?')) {
                                deleteMutation.mutate(post.id);
                              }
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(posts.data?.items.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={5} className="blog-empty">
                        아직 쓴 글이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {suspended && (
          <p className="blog-status">이용이 제한된 계정입니다. 글쓰기와 댓글이 모두 막혀 있습니다.</p>
        )}

        {pending && !suspended && (
          <p className="blog-status">
            저자 신청이 접수되었습니다. 승인되면 이 화면에서 글을 쓸 수 있습니다.
          </p>
        )}

        {!canWrite && !pending && !suspended && (
          <section className="blog-form">
            <h2 className="kh-section-label">저자 신청</h2>
            <p className="blog-header__subtitle">
              승인되면 <code>blog.1989v.com/authors/&lt;핸들&gt;</code> 이 내 공간이 됩니다.
            </p>
            <label className="blog-field">
              <span>핸들 (영소문자·숫자·하이픈 3~30자)</span>
              <input
                className="blog-input"
                value={handle}
                maxLength={30}
                onChange={(e) => setHandle(e.target.value)}
              />
            </label>
            <label className="blog-field">
              <span>표시명</span>
              <input
                className="blog-input"
                value={displayName}
                maxLength={40}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="blog-field">
              <span>소개</span>
              <textarea
                className="blog-textarea"
                value={bio}
                maxLength={300}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <div className="blog-actions">
              <button
                type="button"
                className="blog-btn"
                disabled={applyMutation.isPending || !handle.trim() || !displayName.trim()}
                onClick={() => applyMutation.mutate()}
              >
                신청하기
              </button>
              {profile && (
                <button
                  type="button"
                  className="blog-btn blog-btn--ghost"
                  disabled={profileMutation.isPending}
                  onClick={() => profileMutation.mutate()}
                >
                  프로필만 저장
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </BlogShell>
  );
}
