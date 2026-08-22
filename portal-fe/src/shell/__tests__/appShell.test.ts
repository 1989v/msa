import { describe, expect, it } from 'vitest';
import { shellTabsFor } from '../appShell';

/**
 * 호스트별 탭 구성 고정 (ADR-0080).
 *
 * place 는 셸이 아예 없어서 **관광지를 찜할 수는 있는데 목록으로 갈 길이 없었다** —
 * 라우트도 화면도 준비돼 있는데 진입점만 빠져 있었고, 화면을 만든 사람과 셸을 만든
 * 사람이 달라 아무도 눈치채지 못했다. 그 조합을 여기서 못 박는다.
 */
describe('shellTabsFor — 호스트별 탭', () => {
  const keys = (host: string, path = '/') => (shellTabsFor(host, path) ?? []).map((t) => t.key);

  it('place 는 지도·내 찜·서비스를 갖는다', () => {
    expect(keys('place.1989v.com')).toEqual(['map', 'favorites', 'services']);
  });

  it('game 은 로비·장르·내 찜·서비스를 갖는다', () => {
    expect(keys('game.1989v.com')).toEqual(['lobby', 'genres', 'favorites', 'services']);
  });

  it('찜을 쓰는 호스트에는 모두 찜 탭이 있다', () => {
    // 찜 버튼이 뜨는 호스트와 찜 목록으로 가는 길이 있는 호스트는 같아야 한다
    for (const host of ['1989v.com', 'game.1989v.com', 'place.1989v.com', 'blog.1989v.com']) {
      expect(keys(host), host).toContain('favorites');
    }
  });

  it('resume·deal 은 셸이 없다', () => {
    // 문서·단일 목록 성격이라 탭바가 소음이다 (찜 대상도 아니다)
    expect(shellTabsFor('resume.1989v.com', '/')).toBeNull();
    expect(shellTabsFor('deal.1989v.com', '/')).toBeNull();
  });

  it('게임 플레이 화면과 로그인 화면은 탭바를 숨긴다', () => {
    // 게임: rAF 경합 + 몰입 / 로그인: 일회성 중단 화면
    expect(shellTabsFor('game.1989v.com', '/games/sum-trail')).toBeNull();
    expect(shellTabsFor('1989v.com', '/login')).toBeNull();
    expect(shellTabsFor('1989v.com', '/oauth/callback')).toBeNull();
  });

  it('게임 허브·장르는 플레이 화면이 아니므로 탭바를 유지한다', () => {
    expect(shellTabsFor('game.1989v.com', '/games')).not.toBeNull();
    expect(shellTabsFor('game.1989v.com', '/games/genre/puzzle')).not.toBeNull();
  });
});
