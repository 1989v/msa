import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { displayTitle, listGames, type GameSummary } from '../../api/gameApi';
import { gamePath } from '../../seo/copy.mjs';
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
  useSeo({ title: lang === 'en' ? 'Random Race | 1989v Games' : '랜덤레이스 | 1989v 게임', lang, noindex: true });
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
    <header className="party-header"><h1>{lang === 'en' ? 'Random Race' : '랜덤레이스'}</h1>
      <p>{lang === 'en' ? 'One device, names, and one round.' : '한 기기에서 이름을 넣고 바로 한 판.'}</p></header>
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
      {catalog.status === 'ready' && catalog.games.length === 0 && <p role="status">{lang === 'en' ? 'No supported games available.' : '지원 가능한 게임이 없습니다.'}</p>}
      {catalog.status !== 'loading' && <button className="party-copy" onClick={() => {
        setCatalog({ games: [], status: 'loading' }); setAttempt((a) => a + 1);
      }}>{lang === 'en' ? 'Reload games' : '목록 다시 불러오기'}</button>}
      <div className="party-mode-row" role="group" aria-label={lang === 'en' ? 'Game' : '게임'}>
        {[...catalog.games.map((g) => ({ key: g.slug as DrawChoice, title: displayTitle(g, lang) })),
          ...(catalog.games.length ? [{ key: 'random' as const, title: lang === 'en' ? 'Random' : '무작위' }] : [])].map((g) =>
          <button key={g.key} className={`party-chip${draft.choice === g.key ? ' active' : ''}`} aria-pressed={draft.choice === g.key}
            onClick={() => setDraft({ ...draft, choice: g.key })}>{g.title}</button>)}
      </div>
      {error && <p role="alert" className="party-alert">{error}</p>}
      {!storageOk && <p role="status" className="party-notice">{lang === 'en' ? 'This device cannot keep recent settings. Current input is kept on this screen.' : '이 기기에 최근 설정을 저장할 수 없습니다. 현재 입력은 이 화면에 유지됩니다.'}</p>}
      <button className="party-primary" disabled={!ready} onClick={start}>{lang === 'en' ? 'Start draw' : '추첨 시작'}</button>
      <p className="party-status">{lang === 'en' ? 'Names stay on this device.' : '이름은 이 기기에만 저장됩니다.'}</p>
    </section>
    <section><h2>{lang === 'en' ? 'Join friends online' : '친구와 온라인으로'}</h2>
      <InviteEntry lang={lang} />
      <Link className="party-ghost" to={gamePath(lang, '/party')}>{lang === 'en' ? 'Open an online room' : '온라인 파티 방 열기'}</Link>
    </section>
  </main>;
}
