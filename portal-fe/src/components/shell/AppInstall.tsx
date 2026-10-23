import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Download } from 'lucide-react';
import { flushSync } from 'react-dom';
import KhSheet from './KhSheet';
import './AppInstall.css';
import { InstallContext, installPath, installName, isMobileInstallDevice } from '../../shell/appInstall';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Some embedded browsers and test DOMs lack matchMedia; treat them as a normal browser tab.
const standaloneMedia = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null);

export function AppInstallProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Include query/hash even though neither is persisted: any navigation invalidates the event.
  const route = location.key + location.pathname + location.search + location.hash;
  const current = useRef(route);
  const pending = useRef<{ event: InstallPrompt; route: string; href: string } | null>(null);
  const [standalone, setStandalone] = useState(() => Boolean(standaloneMedia()?.matches) || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [guide, setGuide] = useState<string | null>(null);
  // Privacy/standalone keep their existing manifest policy; desktop only hides our UI.
  const manifestDisabled = window.location.hostname.split('.')[0] === 'resume' || standalone;
  const hidden = manifestDisabled || !isMobileInstallDevice(navigator);
  const link = useRef<HTMLLinkElement | null>(null);

  useLayoutEffect(() => {
    // Commit synchronously before events/paint; the click closure also checks its route.
    current.current = route;
    pending.current = null;
    if (manifestDisabled) return;
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    link.current = manifest;
    // The shell owns one link, including search's established identity.
    document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());
    const update = () => {
      const path = installPath(location.pathname);
      const href = /^\/(search|s)\/?$/i.test(path) ? '/search.webmanifest'
        : `/app.webmanifest?start=${path}&name=${installName(path === '/' && location.pathname !== '/' ? '1989v' : document.title || '1989v')}`;
      if (manifest.getAttribute('href') !== href) { pending.current = null; manifest.setAttribute('href', href); }
    };
    update();
    document.head.append(manifest);
    const observer = new MutationObserver(update);
    const title = document.querySelector('title');
    if (title) observer.observe(title, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); manifest.remove(); link.current = null; pending.current = null; };
  }, [route, manifestDisabled, location.pathname]);

  useEffect(() => {
    const before = (event: Event) => {
      if (hidden || !link.current) return;
      event.preventDefault();
      pending.current = { event: event as InstallPrompt, route: current.current, href: link.current.href };
    };
    const installed = () => { pending.current = null; setGuide(null); };
    const media = standaloneMedia();
    const changed = () => setStandalone(Boolean(media?.matches) || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', installed);
    media?.addEventListener('change', changed);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', installed); media?.removeEventListener('change', changed); };
  }, [hidden]);

  const install = async () => {
    const available = pending.current;
    pending.current = null;
    if (available && available.route === route && available.href === link.current?.href) {
      try { await available.event.prompt(); await available.event.userChoice; return; }
      catch { /* Unsupported/rejected prompts use the same browser-menu guidance. */ }
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setGuide(ios ? 'Safari에서 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.' : '브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요. 메뉴가 없다면 이 브라우저에서는 설치를 지원하지 않습니다.');
  };

  return <InstallContext.Provider value={{ hidden, install }}>
    {children}
    {guide && !hidden && <KhSheet label="이 페이지를 앱으로 설치" onClose={() => setGuide(null)} className="kh-sheet--dialog"><p>{guide}</p><button className="kh-button" onClick={() => setGuide(null)}>닫기</button></KhSheet>}
  </InstallContext.Provider>;
}

export function AppInstallButton({ onBeforeInstall }: { onBeforeInstall?: () => void }) {
  const { hidden, install } = useContext(InstallContext);
  if (hidden) return null;
  return <button type="button" className="gnb-install" aria-label="이 페이지를 앱으로 설치" onClick={() => {
    // Close the invoking sheet before guide/prompt, while retaining user activation.
    if (onBeforeInstall) flushSync(onBeforeInstall);
    void install();
  }}><Download size={18} aria-hidden="true" /><span>앱 설치</span></button>;
}

