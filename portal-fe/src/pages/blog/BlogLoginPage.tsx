import { LOGIN_NEXT_KEY, buildGoogleAuthUrl, buildKakaoAuthUrl } from '../../auth/auth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { blogPrivateMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import BlogShell from './BlogShell';
import './Blog.css';

/**
 * blog 호스트의 로그인 진입점.
 *
 * apex 의 `/shop/login` 을 쓰지 않는 이유는 두 가지다 — 토큰은 localStorage 라
 * **오리진이 다르면 공유되지 않고**, 화면의 브랜드도 쇼핑이 아니다.
 * OAuth 리다이렉트 URI 는 `window.location.origin` 기반이라 이 호스트가 제공자에
 * 등록되어 있어야 한다 (ADR-0072 선행 조건).
 */
export default function BlogLoginPage() {
  useHeritageSurface();
  useSeo(blogPrivateMeta('로그인'));

  const go = (url: string) => {
    // next 는 호출한 화면이 미리 넣어 둔다. 없으면 홈으로 돌아온다.
    if (!sessionStorage.getItem(LOGIN_NEXT_KEY)) sessionStorage.setItem(LOGIN_NEXT_KEY, '/');
    window.location.href = url;
  };

  return (
    <BlogShell title="로그인" subtitle="댓글과 글쓰기에만 필요합니다. 읽기는 로그인 없이 됩니다.">
      <main className="blog-form">
        <button type="button" className="blog-btn" onClick={() => go(buildKakaoAuthUrl())}>
          카카오로 계속하기
        </button>
        <button type="button" className="blog-btn blog-btn--ghost" onClick={() => go(buildGoogleAuthUrl())}>
          구글로 계속하기
        </button>
      </main>
    </BlogShell>
  );
}
