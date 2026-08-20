import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { consumeTabNav } from '../../shell/appShell';
import KhTabBar from './KhTabBar';

/**
 * 앱 셸 크롬 — 라우터 안에서 화면에 상주하는 층.
 *
 * 1) 스택 전환 방향 판정: 내비게이션 타입을 `<html data-nav>` 로 찍는다.
 *    push(전진)·pop(뒤로)·tab(탭 간) 을 kh-shell.css 의 View Transitions
 *    규칙이 읽는다. 속성만 찍을 뿐, 미지원 브라우저에선 아무 일도 없다.
 * 2) 하단 탭바.
 */
export default function AppShellChrome() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    document.documentElement.dataset.nav = consumeTabNav()
      ? 'tab'
      : navType === 'POP'
        ? 'pop'
        : 'push';
  }, [pathname, navType]);

  return <KhTabBar />;
}
