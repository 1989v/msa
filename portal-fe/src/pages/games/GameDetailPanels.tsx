import { displayDescription, type GameDetail, type MyGameRecord } from '../../api/gameApi';
import { StarRating, StarRatingInput, starsFromHalves } from './StarRating';
import type { GameLang } from '../../api/gameApi';

/**
 * 상세 화면의 정보 패널 셋 — 랭킹 / 내 기록 / 평가.
 *
 * **좁은 화면에서는 탭으로 접는다.** 셋을 세로로 쌓으면 첫 화면에서 플레이 버튼이
 * 스크롤 아래로 밀린다 — 게임을 하러 온 사람이 먼저 만나는 것이 정보 더미가 되면 안 된다.
 * 넓은 화면에서는 접을 이유가 없으므로 셋을 한 번에 편다(CSS 가 담당).
 */
function minutes(sec: number, lang: GameLang): string {
  const m = Math.round(sec / 60);
  if (sec < 60) return lang === 'en' ? 'under a minute' : '1분 미만';
  if (m < 60) return lang === 'en' ? `${m} min` : `${m}분`;
  const h = Math.floor(m / 60);
  return lang === 'en' ? `${h}h ${m % 60}m` : `${h}시간 ${m % 60}분`;
}

function sinceLabel(iso: string | null, lang: GameLang): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (lang === 'en') return days <= 0 ? 'today' : `${days}d ago`;
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

/**
 * 정보 패널 셋 — 평가 / 랭킹 / 내 기록.
 *
 * **탭을 쓰지 않는다.** 넓은 화면은 2단이라 접을 이유가 없고, 좁은 화면에서는
 * 썸네일과 플레이 버튼이 이미 첫 화면을 차지하므로 그 아래는 스크롤로 읽는 편이
 * 자연스럽다. 탭은 "무엇이 있는지" 를 감춘다.
 *
 * 배치는 페이지가 정한다 — 여기서는 각 조각이 자기 내용만 안다.
 */
export function GameAboutPanel({ game, lang, myHalves, onRate, ratingMessage, favorites }: {
  game: GameDetail;
  lang: GameLang;
  myHalves: number | null;
  onRate: (halves: number) => void;
  ratingMessage: string | null;
  favorites: number | null;
}) {
  return (
    <section className="game-panel" aria-label={lang === 'en' ? 'About' : '소개'}>
      <div className="game-rating-summary">
        <StarRating value={starsFromHalves(game.ratingAvg)} />
        <span className="game-rating-figure">
          {game.ratingAvg.toFixed(1)}
          <span className="game-stat-sub"> ({game.ratingCount.toLocaleString()}{lang === 'en' ? '' : '표'})</span>
        </span>
        {favorites != null && favorites > 0 && (
          <span className="game-stat-sub">♡ {favorites.toLocaleString()}</span>
        )}
      </div>
      <p className="game-about-body">{displayDescription(game, lang)}</p>
      {/* 별만 늘어놓으면 보여주는 것인지 누르는 것인지 모른다 — 무엇을 하는 자리인지 적는다 */}
      <p className="game-rate-label">
        {myHalves != null
          ? (lang === 'en' ? 'Your rating' : '내 평가')
          : (lang === 'en' ? 'Rate this game' : '이 게임을 평가하기')}
      </p>
      <StarRatingInput halves={myHalves} onRate={onRate} lang={lang} />
      {ratingMessage && <p className="game-panel-note">{ratingMessage}</p>}
    </section>
  );
}

export function GameMyRecordPanel({ record, loggedIn, lang }: {
  record: MyGameRecord | null;
  loggedIn: boolean;
  lang: GameLang;
}) {
  return (
    <section className="game-panel" aria-label={lang === 'en' ? 'My record' : '내 기록'}>
      <h2 className="game-panel-title">{lang === 'en' ? 'My record' : '내 기록'}</h2>
      {!loggedIn ? (
        <p className="game-panel-note">
          {lang === 'en' ? 'Sign in to keep your record.' : '로그인하면 내 기록이 남습니다.'}
        </p>
      ) : !record ? (
        <p className="game-panel-note">{lang === 'en' ? 'Loading…' : '불러오는 중…'}</p>
      ) : record.plays === 0 ? (
        <p className="game-panel-note">{lang === 'en' ? 'No plays yet.' : '아직 플레이 기록이 없습니다.'}</p>
      ) : (
        <>
          {record.hasSave && (
            <p className="game-stage-continue">
              {lang === 'en' ? 'Resumes from your saved progress.' : '저장된 진행에서 이어갑니다.'}
            </p>
          )}
          <dl className="game-stat-grid">
            <div>
              <dt>{lang === 'en' ? 'Plays' : '플레이'}</dt>
              <dd>{record.plays.toLocaleString()}{lang === 'en' ? '' : '회'}</dd>
            </div>
            <div>
              <dt>{lang === 'en' ? 'Total time' : '총 시간'}</dt>
              <dd>{minutes(record.totalSeconds, lang)}</dd>
            </div>
            {record.bestScore != null && (
              <div>
                <dt>{lang === 'en' ? 'Best' : '내 최고'}</dt>
                <dd>
                  {record.bestScore.toLocaleString()}
                  {record.bestRank != null && (
                    <span className="game-stat-sub">
                      {lang === 'en' ? ` · #${record.bestRank}` : ` · ${record.bestRank}위`}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {sinceLabel(record.lastPlayedAt, lang) && (
              <div>
                <dt>{lang === 'en' ? 'Last played' : '마지막 플레이'}</dt>
                <dd>{sinceLabel(record.lastPlayedAt, lang)}</dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}
