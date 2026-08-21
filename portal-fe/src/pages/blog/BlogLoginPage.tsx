import LoginShell from '../../components/chrome/LoginShell';
import LoginProviderButtons from '../../components/chrome/LoginProviderButtons';
import { LOGIN_NEXT_KEY } from '../../auth/auth';
import { blogPrivateMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';

/**
 * blog 호스트의 로그인 진입점.
 *
 * apex 의 `/shop/login` 을 쓰지 않는 이유: 토큰은 localStorage 라 **오리진이 다르면
 * 공유되지 않고**, OAuth 리다이렉트 URI 는 `window.location.origin` 기반이라 이
 * 호스트가 제공자에 등록되어 있어야 한다 (ADR-0072 선행 조건). 화면 자체는 전 호스트
 * 공통 LoginShell — 복귀 경로만 쿼리 대신 세션 선저장이라는 점이 다르다.
 */
export default function BlogLoginPage() {
  useSeo(blogPrivateMeta('로그인'));

  const go = (url: string) => {
    // next 는 호출한 화면이 미리 넣어 둔다. 없으면 홈으로 돌아온다.
    if (!sessionStorage.getItem(LOGIN_NEXT_KEY)) sessionStorage.setItem(LOGIN_NEXT_KEY, '/');
    window.location.href = url;
  };

  return (
    <LoginShell>
      <div>
        <span className="kh-section-label">Account</span>
        <h1 className="login-shell-title">로그인</h1>
        <p className="login-shell-desc">댓글과 글쓰기에만 필요합니다. 읽기는 로그인 없이 됩니다.</p>
      </div>
      <LoginProviderButtons onStart={go} />
    </LoginShell>
  );
}
