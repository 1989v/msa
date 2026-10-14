import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { displayTitle, listGames, type GameSummary } from '../../api/gameApi';
import { drawMeta, hreflangAlternates, HUB_OG_IMAGE, gamePath } from '../../seo/copy.mjs';
import { drawCopy } from '../../seo/gameEditorial.mjs';
import GameDiscoveryLinks from './GameDiscoveryLinks';
import { useSeo } from '../../seo/useSeo';
import InviteEntry from '../party/InviteEntry';
import { DRAW_SLUGS, readDrawDraft, saveDrawDraft, type DrawChoice } from './drawDraft';
import { parseNames, PARTY_MIN, PARTY_MODES, writeParty } from './party';
import '../party/party.css';

/** A single-device draw. Catalog is its only network dependency; no relay is mounted here. */
export default function DrawPage() {
  const lang = useLocation().pathname.startsWith('/en') ? 'en' : 'ko';
  const navigate = useNavigate();
  const [draft, setDraft] = useState(readDrawDraft);
  const [catalog, setCatalog] = useState<{ games: GameSummary[]; status: 'loading' | 'ready' | 'error' }>({ games: [], status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [storageOk, setStorageOk] = useState(true);
  const [error, setError] = useState('');
  const names = parseNames(draft.text);
  const copy = drawCopy(lang);
  const meta = drawMeta(lang);
  useSeo({ ...meta, lang, image: HUB_OG_IMAGE, alternates: hreflangAlternates('/draw') });
  useEffect(() => {
    let active = true;
    listGames({ genre: 'DECIDER', size: 200 }).then((p) => {
      if (active) setCatalog({ status: 'ready', games: p.content.filter((g) =>
        DRAW_SLUGS.some((slug) => slug === g.slug) && g.tags.includes('roster-ready')) });
    }).catch(() => { if (active) setCatalog({ games: [], status: 'error' }); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => { setStorageOk(saveDrawDraft(draft)); }, [draft]);
  const candidates = draft.choice === 'random' ? catalog.games : catalog.games.filter((g) => g.slug === draft.choice);
  const ready = catalog.status === 'ready' && candidates.length > 0 && names.length >= PARTY_MIN;
  function start() {
    if (!ready) return;
    const game = candidates[Math.floor(Math.random() * candidates.length)];
    if (!writeParty(game.slug, names, draft.mode)) {
      setError(lang === 'en' ? 'Cannot save the draw. Allow device storage and try again; your names are kept here.' : '추첨을 저장하지 못했습니다. 기기 저장을 허용한 뒤 다시 시도하세요. 입력은 유지됩니다.');
      return;
    }
    navigate(gamePath(lang, `/games/${game.slug}`));
  }
  return <main className="party-page draw-page kh-arcade">
    <header className="party-header"><h1>{copy.heading}</h1>
      <p>{copy.intro}</p></header>
    <section>
      <label className="party-manual" htmlFor="draw-names">{lang === 'en' ? 'Participants · one per line' : '참가자 · 한 줄에 한 명'}
        <textarea id="draw-names" rows={5} maxLength={2000} spellCheck={false} value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></label>
      <p className="party-status">{lang === 'en' ? `${names.length} participants · 2–12 needed` : `${names.length}명 · 2~12명으로 시작`}</p>
      <div className="party-mode-row" role="group" aria-label={lang === 'en' ? 'Draw mode' : '추첨 방식'}>
        {PARTY_MODES.map((m) => <button key={m.key} className={`party-chip${draft.mode === m.key ? ' active' : ''}`}
          aria-pressed={draft.mode === m.key} onClick={() => setDraft({ ...draft, mode: m.key })}>{lang === 'en' ? m.en : m.ko}</button>)}
      </div>
      <h2>{lang === 'en' ? 'Choose a game' : '게임 선택'}</h2>
      {catalog.status === 'loading' && <p role="status">{lang === 'en' ? 'Loading games…' : '게임 목록을 불러오는 중…'}</p>}
      {catalog.status === 'error' && <p role="alert">{lang === 'en' ? 'Could not load games.' : '게임 목록을 불러오지 못했습니다.'}</p>}
      {catalog.status === 'ready' && catalog.games.length === 0 && <p role="status">{lang === 'en' ? 'No games available right now.' : '지금 이용할 수 있는 게임이 없습니다.'}</p>}
      {(catalog.status === 'error' || (catalog.status === 'ready' && catalog.games.length === 0)) && <button className="party-copy" onClick={() => {
        setCatalog({ games: [], status: 'loading' }); setAttempt((a) => a + 1);
      }}>{lang === 'en' ? 'Try again' : '다시 시도'}</button>}
      <div className="party-mode-row" role="group" aria-label={lang === 'en' ? 'Game' : '게임'}>
        {[...catalog.games.map((g) => ({ key: g.slug as DrawChoice, title: displayTitle(g, lang) })),
          ...(catalog.games.length ? [{ key: 'random' as const, title: lang === 'en' ? 'Random' : '무작위' }] : [])].map((g) =>
          <button key={g.key} className={`party-chip${draft.choice === g.key ? ' active' : ''}`} aria-pressed={draft.choice === g.key}
            onClick={() => setDraft({ ...draft, choice: g.key })}>{g.title}</button>)}
      </div>
      {error && <p role="alert" className="party-alert">{error}</p>}
      {!storageOk && <p role="status" className="party-notice">{lang === 'en' ? 'This device cannot keep recent settings. Current input is kept on this screen.' : '이 기기에 최근 설정을 저장할 수 없습니다. 현재 입력은 이 화면에 유지됩니다.'}</p>}
      <button className="party-primary" disabled={!ready} onClick={start}>{lang === 'en' ? 'Start' : '시작하기'}</button>
      <p className="party-status">{lang === 'en' ? 'Names stay on this device.' : '이름은 이 기기에만 저장됩니다.'}</p>
    </section>
    <section><h2>{lang === 'en' ? 'Play with friends' : '친구와 함께하기'}</h2>
      <p className="party-status">{lang === 'en' ? 'Create a room and invite friends with a link or QR code.' : '방을 만들고 링크나 QR 코드로 친구를 초대하세요.'}</p>
      <InviteEntry lang={lang} />
      <Link className="party-ghost" to={gamePath(lang, '/party')}>{lang === 'en' ? 'Invite friends' : '친구 초대하기'}</Link>
    </section>
    <section aria-labelledby="draw-guide-heading"><h2 id="draw-guide-heading">{copy.guideHeading}</h2>
      <ol>{copy.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <p className="party-status">{copy.privacy}</p>
      <GameDiscoveryLinks lang={lang} />
    </section>
  </main>;
}
