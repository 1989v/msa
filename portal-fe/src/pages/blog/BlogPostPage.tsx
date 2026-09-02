import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  blogErrorMessage,
  clearRating,
  createComment,
  deleteComment,
  editComment,
  fetchComments,
  fetchPost,
  fetchStudioOverview,
  ratePost,
  toggleLike,
  type BlogReaction,
} from '../../api/blogApi';
import { LOGIN_NEXT_KEY } from '../../auth/auth';
import { useAuth } from '../../auth/useAuth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { blogBreadcrumbJsonLd, blogPostMeta, blogPostUrl, blogPostingJsonLd } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import FavoriteButton from '../../components/favorite/FavoriteButton';
import BlogShell from './BlogShell';
import CommentThread from './CommentThread';
import MarkdownBody from './MarkdownBody';
import ReadingProgress from './ReadingProgress';
import { formatDate } from './PostCard';
import ReactionBar from './ReactionBar';
import './Blog.css';
import AdSlot from '../../components/ads/AdSlot';
import { ADSENSE_SLOTS } from '../../seo/copy.mjs';

/**
 * 글 상세.
 *
 * 이 경로는 **백엔드가 meta 를 주입한 HTML** 로 먼저 도착한다 (ADR-0072 §6). SPA 는 그 위에
 * 마운트되고, 여기서 다시 같은 메타를 쓴다 — SPA 내부 전환으로 들어온 경우를 위해서다.
 */
export default function BlogPostPage() {
  useHeritageSurface();
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();

  const post = useQuery({
    queryKey: ['blog', 'post', slug],
    queryFn: () => fetchPost(slug),
    enabled: slug.length > 0,
  });
  const comments = useQuery({
    queryKey: ['blog', 'comments', slug],
    queryFn: () => fetchComments(slug),
    enabled: slug.length > 0,
  });
  // 첫 댓글인지 판단하려면 프로필 유무를 알아야 한다. 로그인했을 때만 부른다.
  const me = useQuery({
    queryKey: ['blog', 'me', 'overview'],
    queryFn: fetchStudioOverview,
    enabled: isLoggedIn,
    staleTime: 60 * 1000,
  });

  const [reaction, setReaction] = useState<BlogReaction | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);

  // 서버가 준 값이 기준. 낙관적 갱신을 하지 않는 이유는 익명 표가 게이트웨이 Rate Limiter 에
  // 걸려 반려될 수 있어서다 — 눌린 것처럼 보였다가 되돌아가면 더 나쁘다.
  useEffect(() => {
    if (!post.data) return;
    setReaction({
      liked: post.data.liked,
      likeCount: post.data.post.likeCount,
      ratingAverage: post.data.post.ratingAverage,
      ratingCount: post.data.post.ratingCount,
      myScore: post.data.myScore,
    });
  }, [post.data]);

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(slug),
    onSuccess: setReaction,
  });
  const rateMutation = useMutation({
    mutationFn: (score: number) =>
      reaction?.myScore === score ? clearRating(slug) : ratePost(slug, score),
    onSuccess: setReaction,
  });
  const commentMutation = useMutation({
    mutationFn: (input: { parentId: number | null; body: string; displayName?: string }) =>
      createComment({ postSlug: slug, ...input }),
    onSuccess: (next) => {
      queryClient.setQueryData(['blog', 'comments', slug], next);
      queryClient.invalidateQueries({ queryKey: ['blog', 'me', 'overview'] });
      setCommentError(null);
    },
    onError: (err) => setCommentError(blogErrorMessage(err, '댓글을 남기지 못했습니다.')),
  });
  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => editComment(id, body),
    onSuccess: (next) => queryClient.setQueryData(['blog', 'comments', slug], next),
    onError: (err) => setCommentError(blogErrorMessage(err, '댓글을 수정하지 못했습니다.')),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteComment(id),
    onSuccess: (next) => queryClient.setQueryData(['blog', 'comments', slug], next),
    onError: (err) => setCommentError(blogErrorMessage(err, '댓글을 삭제하지 못했습니다.')),
  });

  const detail = post.data;
  useSeo(
    detail
      ? {
          ...blogPostMeta(detail.post),
          // copy.mjs 는 순수 JS 라 type 이 string 으로 넓어진다 — 여기서 리터럴로 좁힌다
          type: 'article' as const,
          jsonLd: [
            blogPostingJsonLd(detail.post),
            blogBreadcrumbJsonLd(detail.breadcrumb),
          ].filter(Boolean),
        }
      : { title: '' },
  );

  const requireLogin = () => {
    sessionStorage.setItem(LOGIN_NEXT_KEY, `/posts/${slug}`);
    navigate('/login');
  };

  if (post.isLoading) {
    return (
      <BlogShell>
        <p className="blog-status">불러오는 중…</p>
      </BlogShell>
    );
  }

  if (post.isError || !detail) {
    return (
      <BlogShell title="찾을 수 없는 글">
        <p className="blog-empty">
          요청한 글이 없거나 아직 공개되지 않았습니다. <Link to="/">블로그 홈으로</Link>
        </p>
      </BlogShell>
    );
  }

  const canonical = blogPostUrl(detail.post.slug);

  return (
    <BlogShell>
      <ReadingProgress />
      <article className="blog-article">
        <nav className="blog-breadcrumb kh-mono" aria-label="분류 경로">
          {detail.breadcrumb.map((crumb) => (
            <Link key={crumb.path} to={`/c${crumb.path}`}>
              {crumb.name}
            </Link>
          ))}
        </nav>

        <h1 className="blog-article__title">{detail.post.title}</h1>

        <div className="blog-article__meta kh-mono">
          {detail.post.author.handle ? (
            <Link to={`/authors/${detail.post.author.handle}`}>{detail.post.author.displayName}</Link>
          ) : (
            <span>{detail.post.author.displayName}</span>
          )}
          <span>{formatDate(detail.post.publishedAt)}</span>
          <span>{detail.post.readingMinutes}분</span>
          <span>조회 {detail.post.viewCount}</span>
          {/* 찜 — 좋아요(공감)와 달리 내 목록에 담는 행위라 메타 줄에 둔다 (ADR-0074) */}
          <FavoriteButton type="BLOG_POST" targetKey={detail.post.slug} />
        </div>

        {detail.post.coverImageUrl && (
          <img className="blog-cover" src={detail.post.coverImageUrl} alt="" />
        )}

        {/* 한 줄 요약 — 카드에 나가는 summary 를 본문 앞에도 보인다. 본문 마크다운에
            따로 적지 않아 한 글에 요약이 하나만 있고, 카드와 어긋날 수 없다. */}
        {detail.post.summary && (
          <blockquote className="blog-article__lead">{detail.post.summary}</blockquote>
        )}

        <MarkdownBody source={detail.body} />

        {reaction && (
          <ReactionBar
            reaction={reaction}
            canonical={canonical}
            title={detail.post.title}
            busy={likeMutation.isPending || rateMutation.isPending}
            onToggleLike={() => likeMutation.mutate()}
            onRate={(score) => rateMutation.mutate(score)}
          />
        )}
      </article>

      {/* 본문이 끝난 지점 — 다 읽은 뒤라 읽기를 방해하지 않고, 댓글보다 위여서
          대화 흐름을 자르지도 않는다 (ADR-0076) */}
      <AdSlot slot={ADSENSE_SLOTS.blogPostEnd} shape="horizontal" minHeight={90} />

      <CommentThread
        comments={comments.data ?? []}
        loggedIn={isLoggedIn}
        needsDisplayName={isLoggedIn && me.isFetched && me.data?.profile == null}
        busy={commentMutation.isPending}
        error={commentError}
        onSubmit={(input) => commentMutation.mutate(input)}
        onEdit={(id, body) => editMutation.mutate({ id, body })}
        onDelete={(id) => deleteMutation.mutate(id)}
        onRequireLogin={requireLogin}
      />
    </BlogShell>
  );
}
