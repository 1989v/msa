import { useId } from 'react';
import type { GameLang, GamePlatformLink } from '../../api/gameApi';

export default function GamePlatformLinks({ links = [], lang }: { links?: GamePlatformLink[]; lang: GameLang }) {
  const descriptionId = useId();
  const visible = links.filter((link) => link.platform === 'ROBLOX' &&
    /^https:\/\/www\.roblox\.com\/games\/[1-9][0-9]{0,63}$/.test(link.url) &&
    (link.releaseStatus === 'BETA' || link.releaseStatus === 'RELEASED'));
  if (!visible.length) return null;
  const english = lang === 'en';
  return (
    <div className="game-platform-links">
      {visible.map((link) => (
        <div key={link.platform} className="game-platform-link-row">
          <a className="game-platform-link" href={link.url} target="_blank" rel="noopener noreferrer" aria-describedby={descriptionId}>
            {english ? 'Play the Roblox version' : '로블록스 버전으로 즐기기'} <span aria-hidden="true">↗</span>
          </a>
          {link.releaseStatus === 'BETA' && <span className="game-platform-badge">{english ? 'Beta' : '베타'}</span>}
        </div>
      ))}
      <p id={descriptionId}>{english ? 'Opens in a new tab. A Roblox account and app may be required.' : '새 탭에서 열려요. Roblox 계정과 앱이 필요할 수 있어요.'}</p>
    </div>
  );
}
