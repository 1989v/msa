import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoginShell from '../components/chrome/LoginShell';
import LoginProviderButtons from '../components/chrome/LoginProviderButtons';
import { portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { LOGIN_NEXT_KEY, isLoggedIn, safeNext } from '../auth/auth';

/** OAuth redirect 왕복 동안 복귀 경로 보관 후 인가 페이지로 이동 */
function startOAuth(authUrl: string, next: string | null) {
  if (next) {
    sessionStorage.setItem(LOGIN_NEXT_KEY, next);
  } else {
    sessionStorage.removeItem(LOGIN_NEXT_KEY);
  }
  window.location.href = authUrl;
}

/**
 * 전 서비스 공통 로그인 진입점 — **apex `/login` 하나뿐이다** (ADR-0079).
 *
 * 예전에는 `/shop/login`(쇼핑)과 blog 호스트의 `/login` 둘이었다. 갈라져 있던 이유는
 * ① 토큰이 localStorage 라 오리진 간 공유가 안 되고 ② OAuth 콜백이 호스트별이라
 * 제공자 콘솔에 호스트 수만큼 등록해야 했기 때문이다. 토큰을 도메인 쿠키로 옮기면서
 * 두 이유가 모두 사라져 화면도 하나로 합친다.
 *
 * 경로에서 `shop` 을 뺀 것은 이름이 실제와 어긋나 있었기 때문이다 — 찜·평점·댓글이
 * 전부 이 화면을 거치는데 쇼핑 하위로 보이면 다음 사람이 게임용 로그인을 또 만든다.
 */
export default function LoginPage() {
  useSeo({ title: portalTitle('로그인'), canonical: portalUrl('/login'), noindex: true });
  const [searchParams] = useSearchParams();
  // 다른 호스트에서 넘어온 절대 URL 이므로 반드시 검증한다 (오픈 리다이렉트 방지)
  const next = safeNext(searchParams.get('next'));

  // 이미 로그인 상태면 복귀 경로로. 다른 호스트일 수 있어 navigate 가 아니라 location 이다.
  useEffect(() => {
    if (isLoggedIn()) window.location.replace(next ?? '/');
  }, [next]);

  return (
    <LoginShell>
      <div>
        <span className="kh-section-label">Account</span>
        <h1 className="login-shell-title">로그인</h1>
        <p className="login-shell-desc">
          소셜 계정으로 로그인하면 찜·주문·평점·댓글 등 회원 기능을 쓸 수 있습니다.
        </p>
      </div>
      <LoginProviderButtons onStart={(url) => startOAuth(url, next)} />
    </LoginShell>
  );
}
