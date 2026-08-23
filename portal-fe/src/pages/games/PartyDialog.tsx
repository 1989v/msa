import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PARTY_MAX,
  PARTY_MIN,
  PARTY_MODES,
  defaultNames,
  parseNames,
  writeParty,
  type PartyMode,
} from './party';
import type { GameLang, GameSummary } from '../../api/gameApi';
import { displayTitle } from '../../api/gameApi';

/**
 * 랜덤 순서 뽑기 — 참가자와 방식을 먼저 정하고, **어느 게임으로 정할지는 뽑는다.**
 *
 * 대상은 「순서 정하기」 장르 전체다. 목록을 하드코딩하지 않고 카탈로그에서 받아 쓰므로,
 * 앞으로 이 장르로 게임이 추가되면 코드를 고치지 않아도 바로 뽑기 대상에 들어간다.
 */
export default function PartyDialog({
  games,
  lang,
  onClose,
  onStart,
}: {
  games: GameSummary[];
  lang: GameLang;
  onClose: () => void;
  onStart: (slug: string) => void;
}) {
  const [text, setText] = useState(() => defaultNames(4).join('\n'));
  const [mode, setMode] = useState<PartyMode>('last');
  const [rolling, setRolling] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);

  const names = useMemo(() => parseNames(text), [text]);
  const ready = names.length >= PARTY_MIN && games.length > 0;

  useEffect(() => {
    const pending = timers.current;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, [onClose]);

  function addOne() {
    if (names.length >= PARTY_MAX) return;
    setText((v) => `${v.replace(/\s*$/, '')}\n참가자 ${names.length + 1}`.trim());
  }
  function delOne() {
    if (names.length <= PARTY_MIN) return;
    setText(names.slice(0, -1).join('\n'));
  }

  /** 뽑는 과정을 보여 준다 — 이름만 스쳐 지나가도 "골랐다" 가 납득된다 */
  function roll() {
    if (!ready || rolling) return;
    const pick = games[Math.floor(Math.random() * games.length)];
    const spins = Math.min(10, Math.max(5, games.length * 2));
    for (let i = 0; i < spins; i += 1) {
      timers.current.push(
        window.setTimeout(() => {
          setRolling(displayTitle(games[i % games.length], lang));
        }, i * 90),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        setRolling(displayTitle(pick, lang));
        writeParty(pick.slug, names, mode);
        timers.current.push(window.setTimeout(() => onStart(pick.slug), 700));
      }, spins * 90),
    );
  }

  return (
    <div
      className="party-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="랜덤 순서 뽑기"
      /* 바깥을 누르면 닫힌다 — 작은 화면에서 ✕ 하나만 탈출구면 잘못 눌렀을 때 갇힌다 */
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="party-card">
        <button ref={closeRef} className="party-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        <h2 className="party-title">🎲 랜덤 순서 뽑기</h2>
        <p className="party-sub">
          참가자와 방식만 정하면, <b>어느 게임으로 정할지는 뽑아서</b> 바로 시작한다.
        </p>

        <section className="party-sec">
          <div className="party-head">
            <span>참가자</span>
            <span className="party-count">{names.length}명</span>
          </div>
          <textarea
            className="party-ta"
            rows={5}
            spellCheck={false}
            aria-label="참가자 목록"
            placeholder="한 줄에 한 명"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="party-chips">
            {names.map((n, i) => (
              <span className="party-chip" key={`${n}-${i}`}>
                {n}
              </span>
            ))}
          </div>
          <div className="party-btns">
            <button className="party-mini" onClick={addOne} disabled={names.length >= PARTY_MAX}>
              ＋ 추가
            </button>
            <button className="party-mini" onClick={delOne} disabled={names.length <= PARTY_MIN}>
              － 빼기
            </button>
          </div>
        </section>

        <section className="party-sec">
          <div className="party-head">
            <span>무엇을 정할까</span>
          </div>
          <div className="party-modes">
            {PARTY_MODES.map((m) => (
              <button
                key={m.key}
                className={`party-mode${m.key === mode ? ' on' : ''}`}
                onClick={() => setMode(m.key)}
              >
                <b>{lang === 'en' ? m.en : m.ko}</b>
                <span>{m.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="party-sec">
          <div className="party-head">
            <span>뽑기 대상</span>
            <span className="party-count">{games.length}종</span>
          </div>
          <div className="party-chips">
            {games.map((g) => (
              <span className="party-chip" key={g.slug}>
                {displayTitle(g, lang)}
              </span>
            ))}
          </div>
        </section>

        <button className="party-go" onClick={roll} disabled={!ready || !!rolling}>
          {rolling ? rolling : '🎲 랜덤으로 돌리기'}
        </button>
        <p className="party-note">
          참가자 이름은 이 기기에만 두고 어디로도 보내지 않는다. 결과는 미리 정해 두지 않고
          고른 게임이 실제로 돌려서 낸다.
        </p>
      </div>
    </div>
  );
}
