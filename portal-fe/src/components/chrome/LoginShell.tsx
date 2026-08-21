import type { ReactNode } from 'react';
import Footer from '../Footer';
import ThemeToggle from '../ThemeToggle';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useReveal } from '../../hooks/useReveal';
import './LoginShell.css';

/**
 * 인증 화면 공통 껍데기 — 모든 호스트의 로그인·OAuth 콜백이 이 셸 하나를 입는다.
 *
 * 로그인 진입은 서비스마다 갈리지만(게임 찜, 블로그 댓글, 쇼핑 주문) 화면은 계정이라는
 * 하나의 일이다. 머리띠는 GNB 의 기와 idiom 을 따르되 서비스 메뉴를 얹지 않는다 —
 * 인증 중의 이동은 전부 플로우 이탈이라 남길 길은 본진(홈)과 테마 토글뿐이다.
 *
 * Footer 처럼 라우터 컨텍스트에 기대지 않는다 — 로고는 Link 가 아니라 앵커다.
 * (blog 는 오리진이 달라 어차피 SPA 이동이 아니고, 앵커는 진행 중인 플로우 상태를
 * 건드리지 않는다 — 복귀 경로는 제공사 버튼을 누르는 순간에야 세션에 실린다.)
 */
export default function LoginShell({ children }: { children: ReactNode }) {
  useHeritageSurface();
  const reveal = useReveal();

  return (
    <div className="login-shell">
      <header className="login-shell-bar">
        <div className="login-shell-bar-inner">
          <a className="login-shell-logo" href="/">
            1989v
          </a>
          <ThemeToggle />
        </div>
      </header>
      <main className="login-shell-main" ref={reveal}>
        <section className="login-shell-card kh-seep">{children}</section>
      </main>
      <Footer />
    </div>
  );
}
