import { Link } from 'react-router-dom';
import { useSeo } from '../seo/useSeo';
import { useHeritageSurface } from '../hooks/useHeritageSurface';

/**
 * 없는 주소.
 *
 * 이 화면이 없던 동안 알 수 없는 경로는 `<Routes>` 가 아무것도 그리지 않아 **빈 본문 + 셸의
 * 기본 타이틀**로 남았다. nginx 는 SPA 폴백이라 200 을 주므로, 검색엔진에는 "본문 없는
 * 페이지가 같은 제목으로 수없이 많은 사이트" 로 보인다 (서치콘솔의 소프트 404 · 중복 제목).
 *
 * 서버가 상태 코드를 못 바꾸는 자리라 **noindex 가 그 일을 대신한다.** follow 는 남긴다 —
 * 링크 그래프까지 끊을 이유는 없고, 아래 되돌아가는 링크가 크롤러의 출구가 된다.
 */
export default function NotFoundPage() {
  useHeritageSurface();
  const sub = window.location.hostname.split('.')[0];
  const lang = window.location.pathname.startsWith('/en') ? 'en' : 'ko';
  const L = lang === 'en' ? EN : KO;

  useSeo({ title: L.title, description: L.description, lang, noindex: true });

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '96px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 13, letterSpacing: '.08em', color: 'var(--ko-text-muted)' }}>404</p>
      <h1 style={{ fontSize: 24, margin: '8px 0 12px' }}>{L.heading}</h1>
      <p style={{ color: 'var(--ko-text-muted)', margin: '0 0 28px' }}>{L.description}</p>
      <Link to="/">{L.home[sub] ?? L.home.default}</Link>
    </div>
  );
}

/** 되돌아갈 곳은 호스트마다 다르다 — game 호스트에서 "메인으로" 는 게임 허브를 뜻한다 */
const KO = {
  title: '찾을 수 없는 페이지 | 1989v',
  heading: '페이지를 찾을 수 없습니다',
  description: '주소가 바뀌었거나 삭제된 페이지입니다.',
  home: {
    game: '게임 허브로',
    place: '관광지 탐색으로',
    blog: '블로그 홈으로',
    deal: '혜택 허브로',
    rank: '랭킹 홈으로',
    default: '메인으로',
  } as Record<string, string>,
} as const;

const EN = {
  title: 'Page not found | 1989v',
  heading: 'Page not found',
  description: 'This address has moved or no longer exists.',
  home: {
    game: 'Back to games',
    place: 'Back to Explore Korea',
    blog: 'Back to the blog',
    deal: 'Back to deals',
    rank: 'Back to rankings',
    default: 'Back to home',
  } as Record<string, string>,
} as const;
