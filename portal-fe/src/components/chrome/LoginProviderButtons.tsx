import { buildGoogleAuthUrl, buildKakaoAuthUrl } from '../../auth/auth';
import './LoginShell.css';

/**
 * 제공사 심볼. 각 사가 로그인 버튼에 요구하는 형태라 우리 아이콘 세트로 대체하지 않는다 —
 * 사용자가 어느 계정으로 들어가는지 글자보다 마크로 먼저 알아본다.
 */
function KakaoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M9 1C4.58 1 1 3.82 1 7.29c0 2.25 1.5 4.22 3.75 5.33-.17.6-.6 2.17-.69 2.5-.11.42.15.41.32.3.13-.09 2.11-1.43 2.97-2.02.54.08 1.09.12 1.65.12 4.42 0 8-2.82 8-6.23S13.42 1 9 1z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/**
 * OAuth 제공사 버튼 묶음 — 로그인 화면의 본문.
 *
 * 인가 URL 만들기까지가 이 컴포넌트의 몫이고, 복귀 경로 보관은 호스트마다 달라
 * (쇼핑 계열: `?next=` 쿼리에서, 블로그: 호출 화면이 세션에 선저장) 호출부가
 * `onStart` 로 잇는다. 브랜드 색은 테마를 타지 않는다 — 각 사 규정색이라
 * 라이트/다크 어디서든 그대로다.
 */
export default function LoginProviderButtons({ onStart }: { onStart: (authUrl: string) => void }) {
  return (
    <div className="login-shell-actions">
      <button
        type="button"
        className="login-provider-btn login-provider-btn--kakao kh-press"
        onClick={() => onStart(buildKakaoAuthUrl())}
      >
        <KakaoMark />
        카카오로 계속하기
      </button>
      <button
        type="button"
        className="login-provider-btn login-provider-btn--google kh-press"
        onClick={() => onStart(buildGoogleAuthUrl())}
      >
        <GoogleMark />
        구글로 계속하기
      </button>
    </div>
  );
}
