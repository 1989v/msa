import { useState } from 'react';
import { androidBrowser, chromeIntent, copyGameLink, kakaoBrowser } from './browserHelp';
export default function GameBrowserHelp({ status }: { status: string }) {
  const [copyStatus, setCopyStatus] = useState('');
  const kakao = kakaoBrowser(navigator.userAgent), android = androidBrowser(navigator.userAgent);
  if (!kakao && !status) return null;
  const href = window.location.href, intent = android ? chromeIntent(href) : null;
  return <details className="game-browser-help" open={!!status}>
    <summary>{kakao ? '카카오 큰 화면 도움말' : '전체화면 결과·도움말'}</summary>
    {status && <p role="status">{status}</p>}
    {kakao && <><p>카카오의 상하단바와 회전 제한은 웹페이지가 직접 해제할 수 없습니다. 카카오 메뉴에서 외부 브라우저로 열고, 기기 자동 회전 설정을 확인하세요.</p>
      {intent && <a href={intent}>Chrome에서 열기</a>}<button type="button" onClick={() => void copyGameLink(href, navigator.clipboard).then(setCopyStatus)}>현재 링크 복사</button>
      <p>브라우저를 바꾸면 다시 로그인하거나 저장을 불러와야 할 수 있습니다. Chrome 열기가 동작하지 않으면 카카오 메뉴의 외부 브라우저 열기 또는 링크 복사를 이용하세요. iPhone은 메뉴에서 Safari 등 외부 브라우저로 열어 주세요.</p>
      {copyStatus && <p role="status">{copyStatus}</p>}</>}
  </details>;
}
