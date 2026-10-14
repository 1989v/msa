import { Link } from 'react-router-dom';
import type { GameLang } from '../../api/gameApi';
import { gameDiscoveryLinks } from '../../seo/copy.mjs';

export default function GameDiscoveryLinks({ lang }: { lang: GameLang }) {
  const discovery = gameDiscoveryLinks(lang);
  return <nav className="games-guide" aria-label={discovery.heading}>
    <h2>{discovery.heading}</h2>
    <ul>{discovery.links.map((link) => <li key={link.href}><Link to={link.href}>{link.label}</Link></li>)}</ul>
  </nav>;
}
