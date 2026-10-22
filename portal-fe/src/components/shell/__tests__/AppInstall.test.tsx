import { act, fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppInstallProvider, AppInstallButton } from '../AppInstall';
import { installPath, installName } from '../../../shell/appInstall';
function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/cafe?lat=37&token=secret#private')}>move</button><button onClick={() => navigate('/search?q=secret')}>search</button></>;
}
function setup(path = '/tech') {
  return render(<MemoryRouter initialEntries={[path]}><AppInstallProvider><Navigation /><AppInstallButton /></AppInstallProvider></MemoryRouter>);
}
function prompt(reject = false) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const show = vi.fn(reject ? () => Promise.reject(new Error('blocked')) : () => Promise.resolve());
  Object.assign(event, { prompt: show, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  act(() => { window.dispatchEvent(event); });
  return show;
}
beforeEach(() => {
  document.title = '카페 비교 | 1989v';
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('page installation', () => {
  it.each(['//evil.com', '/%2f%2fevil', '/x/../secret', '/..', '/d/token', '/shared/AbCd012345', '/party/ABCD', '/en/party/ABCD', '/resume/d/token', '/oauth/callback', '/%0A', '/%ZZ', '/%FF', '/%61', '/%2E', '/%2522', '/x?token=secret', '/' + 'x'.repeat(512)])('rejects %s', path => expect(installPath(path)).toBe('/'));
  it('keeps Korean paths and bounded page names', () => {
    expect(installPath('/cafe/drink/' + encodeURIComponent('Cold Brew(Large)'))).toBe('/cafe/drink/Cold%20Brew%28Large%29');
    expect(installPath('/cafe/drink/Cold%20Brew%28Large%29')).toBe('/cafe/drink/Cold%20Brew%28Large%29');
    expect(installPath('/cafe/%EC%BB%A4%ED%94%BC')).toBe('/cafe/%EC%BB%A4%ED%94%BC');
    const escaped = installName('검색 | 1989v').match(/.{4}/g)!.map(unit => '\\u' + unit).join('');
    expect(JSON.parse('"' + escaped + '"').trim()).toBe('검색');
    expect(installName('검색 | 1989v')).toHaveLength(64);
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
