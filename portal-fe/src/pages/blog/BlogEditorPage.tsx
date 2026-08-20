import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  blogErrorMessage,
  createPost,
  fetchCategories,
  fetchMyPost,
  flattenCategories,
  publishPost,
  updatePost,
  type BlogPostInput,
} from '../../api/blogApi';
import { useAuth } from '../../auth/useAuth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { blogPrivateMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import BlogShell from './BlogShell';
import MarkdownBody from './MarkdownBody';
import './Blog.css';

/**
 * 글 편집기 (작성자 스튜디오).
 *
 * 슬러그는 **새 글에서만** 정할 수 있다. 발행된 뒤 주소가 바뀌면 공유된 링크와 색인이
 * 죽기 때문이고, 서버도 수정 시 슬러그를 무시한다 — 화면에서만 막으면 API 로 우회된다.
 */
export default function BlogEditorPage() {
  useHeritageSurface();
  const { id } = useParams();
  const postId = id ? Number(id) : null;
  useSeo(blogPrivateMeta(postId ? '글 수정' : '새 글'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();

  const categories = useQuery({
    queryKey: ['blog', 'categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
  const existing = useQuery({
    queryKey: ['blog', 'me', 'post', postId],
    queryFn: () => fetchMyPost(postId as number),
    enabled: isLoggedIn && postId != null,
  });

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [summary, setSummary] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detail = existing.data;
    if (!detail) return;
    setTitle(detail.post.title);
    setSlug(detail.post.slug);
    setSummary(detail.post.summary);
    setCoverImageUrl(detail.post.coverImageUrl ?? '');
    setBody(detail.body);
  }, [existing.data]);

  // 카테고리는 잎(하위가 없는 마디)만 고르게 한다 — 상위에 글을 붙이면 하위 분류가 비어
  // 보이고, 상위 조회는 어차피 서브트리를 긁으므로 잃는 것이 없다
  const options = flattenCategories(categories.data ?? []).filter((c) => c.children.length === 0);

  useEffect(() => {
    if (categoryId != null || options.length === 0) return;
    const current = existing.data
      ? options.find((c) => c.path === existing.data?.post.categoryPath)
      : undefined;
    setCategoryId(current?.id ?? options[0].id);
  }, [options, categoryId, existing.data]);

  const input = (): BlogPostInput => ({
    title: title.trim(),
    slug: postId ? null : slug.trim() || null,
    categoryId: categoryId as number,
    summary: summary.trim() || null,
    body,
    coverImageUrl: coverImageUrl.trim() || null,
  });

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const saved = postId ? await updatePost(postId, input()) : await createPost(input());
      if (publish) await publishPost(saved.id);
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog', 'me'] });
      navigate('/studio');
    },
    onError: (err) => setError(blogErrorMessage(err, '저장하지 못했습니다.')),
  });

  if (!isLoggedIn) {
    return (
      <BlogShell title="새 글">
        <p className="blog-status">로그인이 필요합니다.</p>
      </BlogShell>
    );
  }

  const ready = title.trim().length > 0 && body.trim().length > 0 && categoryId != null;

  return (
    <BlogShell title={postId ? '글 수정' : '새 글'}>
      <main className="blog-form blog-form--wide">
        {error && <p className="blog-error">{error}</p>}

        <label className="blog-field">
          <span>제목</span>
          <input
            className="blog-input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {!postId && (
          <label className="blog-field">
            <span>슬러그 (비우면 서버가 정합니다 — 한글 제목이면 날짜+임의값)</span>
            <input
              className="blog-input"
              value={slug}
              maxLength={80}
              placeholder="my-first-post"
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
        )}

        <label className="blog-field">
          <span>분류</span>
          <select
            className="blog-select"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.path.trim().replace(/^\//, '').split('/').join(' > ')}
              </option>
            ))}
          </select>
        </label>

        <label className="blog-field">
          <span>요약 (검색결과·공유 카드에 쓰입니다. 비우면 본문에서 뽑습니다)</span>
          <textarea
            className="blog-textarea"
            value={summary}
            maxLength={300}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>

        <label className="blog-field">
          <span>대표 이미지 URL (업로드는 아직 없습니다 — 외부 주소를 넣습니다)</span>
          <input
            className="blog-input"
            value={coverImageUrl}
            maxLength={1000}
            placeholder="https://…"
            onChange={(e) => setCoverImageUrl(e.target.value)}
          />
        </label>

        <div className="blog-editor">
          <label className="blog-field">
            <span>본문 (마크다운)</span>
            <textarea
              className="blog-textarea blog-textarea--body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="blog-field">
            <span>미리보기</span>
            <div className="blog-preview">
              <MarkdownBody source={body} />
            </div>
          </div>
        </div>

        <div className="blog-actions">
          <button
            type="button"
            className="blog-btn blog-btn--ghost"
            disabled={!ready || saveMutation.isPending}
            onClick={() => saveMutation.mutate(false)}
          >
            초안으로 저장
          </button>
          <button
            type="button"
            className="blog-btn"
            disabled={!ready || saveMutation.isPending}
            onClick={() => saveMutation.mutate(true)}
          >
            발행
          </button>
          <button type="button" className="blog-linkbtn" onClick={() => navigate('/studio')}>
            취소
          </button>
        </div>
      </main>
    </BlogShell>
  );
}
