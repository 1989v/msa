import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchGasAreas, fetchRankingBoards } from '../../api/rankingApi';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/ThemeToggle';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { RANK_COVERAGE_NOTE, RANK_GAS_SOURCE, rankHubMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { capturedLabel, formatPrice } from './rankView';
import './RankPage.css';

// ADR-0081 랭킹 리더보드 — rank.<domain> 이 정규 주소 (place/deal/blog 과 같은 host 인식 루트 라우팅).
//
// 지역 목록은 **보드가 있는 곳만** 온다. 고를 수 있는 것과 데이터가 있는 것이 어긋나면
// 고르자마자 빈 화면이 되고, 그건 서비스가 고장난 것처럼 보인다.

export default function RankPage() {
  useHeritageSurface();
  useSeo(rankHubMeta());

  const [scope, setScope] = useState<string>('');

  const areas = useQuery({
    queryKey: ['ranking', 'gas', 'areas'],
    queryFn: fetchGasAreas,
    staleTime: 30 * 60 * 1000,
  });

  const boards = useQuery({
    queryKey: ['ranking', 'boards', scope],
    queryFn: () => fetchRankingBoards(scope || undefined),
    staleTime: 5 * 60 * 1000,
  });

  const shown = useMemo(() => boards.data ?? [], [boards.data]);
  const captured = capturedLabel(shown.find((b) => b.capturedAt)?.capturedAt ?? null);

  return (
    <div className="rank-page">
      <header className="rank-header">
        <div className="rank-header__bar">
          <a className="rank-header__brand kh-display" href="https://1989v.com">
            1989v
          </a>
          <ThemeToggle />
        </div>
        <h1 className="rank-header__title kh-display">
          <span className="kh-display-accent">랭킹</span> 리더보드
        </h1>
        <p className="rank-header__subtitle">
          지역별 최저가 주유소를 매일 새로 줄 세웁니다. 어제 대비 등락을 함께 봅니다.
        </p>
      </header>

      <Link to="/cafe" className="rank-cta kh-button-ghost">카페 음료 영양정보 비교</Link>
      <div className="rank-toolbar">
        <label className="rank-field">
          <span className="kh-section-label">지역</span>
          <select
            className="rank-select"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={areas.isLoading}
          >
            <option value="">전체</option>
            {(areas.data ?? []).map((area) => (
              <option key={area.code} value={area.code}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        {captured && <span className="rank-captured kh-mono">{captured}</span>}
      </div>

      <main className="rank-main">
        {boards.isLoading && <p className="rank-state">불러오는 중…</p>}
        {boards.isError && (
          <div role="alert"><p className="rank-state kh-status-error">랭킹을 불러오지 못했습니다.</p><button className="kh-button" onClick={() => void boards.refetch()} disabled={boards.isFetching}>다시 불러오기</button></div>
        )}
        {!boards.isLoading && !boards.isError && shown.length === 0 && (
          <p className="rank-state" role="status">{scope ? '이 지역에 집계된 랭킹이 없습니다. 다른 지역을 선택해 주세요.' : '랭킹 서비스를 준비 중입니다. 아직 집계된 데이터가 없습니다.'} <a href="https://1989v.com/#services">다른 서비스 둘러보기</a></p>
        )}

        <div className="rank-grid">
          {shown.map((board) => (
            <Link key={board.slug} className="rank-card kh-slab kh-slab-offset" to={`/boards/${board.slug}`}>
              <span className="rank-card__scope kh-caps">{board.scopeName}</span>
              <h2 className="rank-card__title">{board.title}</h2>
              {board.topName && (
                <p className="rank-card__top">
                  <span className="rank-card__medal kh-mono">1</span>
                  <span className="rank-card__topname">{board.topName}</span>
                  <span className="rank-card__price kh-mono">
                    {formatPrice(board.topScore)}
                    <em>{board.unit}</em>
                  </span>
                </p>
              )}
              <span className="rank-card__count kh-mono">{board.entryCount}곳</span>
            </Link>
          ))}
        </div>
      </main>

      <Footer>
        <p>{RANK_COVERAGE_NOTE}</p>
        <p>{RANK_GAS_SOURCE}</p>
      </Footer>
    </div>
  );
}
