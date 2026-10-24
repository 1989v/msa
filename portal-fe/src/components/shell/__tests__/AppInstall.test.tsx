import { act, fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppInstallProvider, AppInstallButton } from '../AppInstall';
import GNB from '../../GNB';
import AppInstallMenu from '../AppInstallMenu';
import { installPath, installName, isMobileInstallDevice } from '../../../shell/appInstall';
function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/cafe?lat=37&token=secret#private')}>move</button><button onClick={() => navigate('/search?q=secret')}>search</button></>;
}
function setup(path = '/tech', control = <AppInstallButton />) {
  return render(<MemoryRouter initialEntries={[path]}><AppInstallProvider><Navigation />{control}</AppInstallProvider></MemoryRouter>);
}
function prompt(reject = false) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const show = vi.fn(reject ? () => Promise.reject(new Error('blocked')) : () => Promise.resolve());
  Object.assign(event, { prompt: show, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  act(() => { window.dispatchEvent(event); });
  return show;
}
vi.mock('../../../hooks/useResumeStatus', () => ({ useResumeStatus: () => false }));
vi.mock('../../../hooks/useScrollDirection', () => ({ useScrollDirection: () => false }));
vi.mock('../../AuthButton', () => ({ default: () => null }));
vi.mock('../../ThemeToggle', () => ({ default: () => null }));
vi.mock('../../chrome/ServiceExplorer', () => ({ default: () => null }));
beforeEach(() => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Chrome Mobile');
  document.title = '카페 비교 | 1989v';
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const decode = (hex: string) => String.fromCharCode(...hex.match(/.{4}/g)!.map(unit => parseInt(unit, 16))).trimEnd();

describe('page installation', () => {
  it.each(['//evil.com', '/%2f%2fevil', '/x/../secret', '/..', '/d/token', '/shared/AbCd012345', '/party/ABCD', '/en/party/ABCD', '/resume/d/token', '/oauth/callback', '/%0A', '/%ZZ', '/%FF', '/%61', '/%2E', '/%2522', '/x?token=secret', '/' + 'x'.repeat(512)])('rejects %s', path => expect(installPath(path)).toBe('/'));
  it('keeps Korean paths and bounded page names', () => {
    expect(installPath('/cafe/drink/' + encodeURIComponent('Cold Brew(Large)'))).toBe('/cafe/drink/Cold%20Brew%28Large%29');
    expect(installPath('/cafe/drink/Cold%20Brew%28Large%29')).toBe('/cafe/drink/Cold%20Brew%28Large%29');
    expect(installPath('/cafe/%EC%BB%A4%ED%94%BC')).toBe('/cafe/%EC%BB%A4%ED%94%BC');
    const escaped = installName('검색 | 1989v').match(/.{4}/g)!.map(unit => '\\u' + unit).join('');
    expect(JSON.parse('"' + escaped + '"').trim()).toBe('검색');
    expect(installName('검색 | 1989v')).toHaveLength(64);
    expect(decode(installName('카페 음료 성분 비교 · 커피 카페인·당류·칼로리 | 1989v 랭킹'))).toBe('카페 음료 성분 비교');
    expect(decode(installName('아메리카노 카페인·당류·칼로리 카페별 비교 | 1989v 랭킹'))).toBe('아메리카노 카페인·당류·칼로리');
    expect(decode(installName('1989v 랭킹 — 카페 음료 성분 비교'))).toBe('1989v 랭킹');
  });
  it.each(['/search/', '/s/', '/SEARCH'])('preserves legacy identity for %s', path => {
    setup(path); expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/search.webmanifest');
  });
  it('owns one link, strips private query/hash, preserves search identity', () => {
    setup('/cafe?code=private&lat=37#token');
    expect(document.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toMatch(/^\/app.webmanifest\?start=\/cafe&name=/);
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).not.toMatch(/private|lat=|token/);
    fireEvent.click(screen.getByText('search'));
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/search.webmanifest');
  });
  it('invalidates a stored prompt synchronously on navigation', async () => {
    setup(); const show = prompt(); fireEvent.click(screen.getByText('move'));
    fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    expect(show).not.toHaveBeenCalled(); expect(await screen.findByRole('dialog')).toHaveTextContent('브라우저 메뉴');
  });
  it('consumes fresh prompt once, appinstalled still permits another page installation', async () => {
    setup(); const show = prompt(); fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    await waitFor(() => expect(show).toHaveBeenCalledTimes(1));
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    fireEvent.click(screen.getByText('move')); const next = prompt();
    fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('handles prompt rejection with accessible dismissible guidance', async () => {
    setup(); prompt(true); fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('브라우저 메뉴');
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('guides iOS through Safari share menu', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
    setup(); fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Safari에서 공유');
  });
  it('hides in actual standalone mode', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    setup(); expect(screen.queryByRole('button', { name: '이 페이지를 앱으로 설치' })).toBeNull();
  });
});


describe('mobile install menus', () => {
  it.each([
    ['iPhone Safari', 'iPhone', 1, undefined, true],
    ['Android Chrome Mobile', 'Linux armv8l', 5, undefined, true],
    ['Android Chrome Tablet', 'Linux armv8l', 5, false, true],
    ['iPad Safari', 'iPad', 5, undefined, true],
    ['Macintosh Safari', 'MacIntel', 5, undefined, true],
    ['Windows Chrome', 'Win32', 10, false, false],
    ['Macintosh Chrome', 'MacIntel', 0, false, false],
    ['Reduced agent', '', 0, true, true],
  ])('detects %s on %s without viewport signals', (userAgent, platform, maxTouchPoints, mobile, expected) => {
    expect(isMobileInstallDevice({ userAgent, platform, maxTouchPoints, userAgentData: { mobile } })).toBe(expected);
  });
  it('hides all custom install UI on a narrow desktop but retains manifest and native browser promotion', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows Chrome');
    vi.stubGlobal('innerWidth', 375);
    setup('/tech', <><AppInstallButton /><AppInstallMenu /></>);
    expect(screen.queryByRole('button', { name: '이 페이지를 앱으로 설치' })).toBeNull();
    expect(screen.queryByRole('button', { name: '서비스 메뉴' })).toBeNull();
    expect(document.querySelector('link[rel="manifest"]')).not.toBeNull();
    const event = new Event('beforeinstallprompt', { cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
  });
  it('boots and offers manual guidance when matchMedia is missing', async () => {
    vi.stubGlobal('matchMedia', undefined);
    setup('/tech', <AppInstallMenu />);
    fireEvent.click(screen.getByRole('button', { name: '서비스 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    expect(screen.queryByRole('dialog', { name: '서비스 메뉴' })).toBeNull();
    expect(await screen.findByRole('dialog', { name: '이 페이지를 앱으로 설치' })).toHaveTextContent('브라우저 메뉴');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
  it('closes its menu before synchronously invoking prompt and restores focus on Escape', () => {
    setup('/tech', <AppInstallMenu />);
    const trigger = screen.getByRole('button', { name: '서비스 메뉴' }); trigger.focus(); fireEvent.click(trigger);
    const show = vi.fn(() => { expect(screen.queryByRole('dialog')).toBeNull(); return Promise.resolve(); });
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: show, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    act(() => { window.dispatchEvent(event); });
    fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    expect(show).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger); fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(trigger).toHaveFocus();
  });
  it('hides the open menu on a live standalone change', () => {
    let changed = () => {};
    const media = { matches: false, addEventListener: (_type: string, handler: () => void) => { changed = handler; }, removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => media);
    setup('/tech', <AppInstallMenu />);
    fireEvent.click(screen.getByRole('button', { name: '서비스 메뉴' }));
    media.matches = true; act(() => { changed(); });
    expect(screen.queryByRole('button', { name: '서비스 메뉴' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('hides when iOS navigator.standalone is true', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    try {
      setup('/tech', <><AppInstallButton /><AppInstallMenu /></>);
      expect(screen.queryByRole('button', { name: '서비스 메뉴' })).toBeNull();
      expect(screen.queryByRole('button', { name: '이 페이지를 앱으로 설치' })).toBeNull();
    } finally { Reflect.deleteProperty(navigator, 'standalone'); }
  });
  it('places the GNB install action inside the drawer and closes it before guidance', async () => {
    setup('/tech', <GNB items={[{ label: '홈', href: '/' }]} />);
    expect(screen.queryByRole('button', { name: '이 페이지를 앱으로 설치' })).toBeNull();
    const trigger = screen.getByRole('button', { name: '메뉴' });
    expect(trigger).toHaveClass('gnb-hamburger--install');
    trigger.focus(); fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '이 페이지를 앱으로 설치' }));
    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
    expect(await screen.findByRole('dialog', { name: '이 페이지를 앱으로 설치' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
  it.each(['desktop', 'standalone'])('preserves ordinary GNB navigation in %s', environment => {
    if (environment === 'desktop') vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows Chrome');
    else vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    setup('/tech', <GNB items={[{ label: '홈', href: '/' }]} />);
    fireEvent.click(screen.getByLabelText('메뉴'));
    expect(screen.queryByRole('button', { name: '이 페이지를 앱으로 설치' })).toBeNull();
    expect(screen.getByRole('link', { name: '내 찜' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '서비스 탐색' })).toBeInTheDocument();
  });
});
