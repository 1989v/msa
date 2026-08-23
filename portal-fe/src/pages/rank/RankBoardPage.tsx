import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchRankingBoard, type RankingEntry } from '../../api/rankingApi';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/ThemeToggle';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { RANK_GAS_SOURCE, rankBoardMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import {
  capturedLabel,
  formatPrice,
  googleMapsDirectionsUrl,
  movementLabel,
  movementTone,
  payloadNumber,
} from './rankView';
import './RankPage.css';

// ADR-0081 — 리더보드 상세. 순위·가격·등락이 한 줄에 다 보여야 한다.
//
// 길안내는 구글맵으로 넘긴다. 경로를 우리가 계산하려면 요청마다 유료 API 를 불러야 하고,
// 출발지가 전국에 흩어지면 캐시도 듣지 않는다. Maps URLs 는 조립 링크라 키·쿼터가 없다.

function payloadText(entry: RankingEntry, key: string): string | null {
  const value = entry.payload[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function EntryRow({ entry, unit }: { entry: RankingEntry; unit: string }) {
  const brand = payloadText(entry, 'brandName') ?? payloadText(entry, 'brandCode');
  const address = payloadText(entry, 'roadAddress');
  const isSelf = entry.payload.isSelf === true;

  return (
    <li className="rank-row kh-slab">
      <span className="rank-row__rank kh-mono">{entry.rank}</span>
      <span className={`rank-row__move kh-mono ${movementTone(entry.movement)}`}>
        {movementLabel(entry.movement)}
      </span>
      <span className="rank-row__body">
        <span className="rank-row__name">{entry.subjectName}</span>
        {address && <span className="rank-row__addr">{address}</span>}
        <span className="rank-row__tags">
          {brand && <span className="rank-tag kh-caps">{brand}</span>}
          {isSelf && <span className="rank-tag kh-caps is-self">셀프</span>}
        </span>
      </span>
      <span className="rank-row__score kh-mono">
        {formatPrice(entry.score)}
        <em>{unit}</em>
      </span>
      <a
        className="rank-row__nav kh-button-ghost"
        href={googleMapsDirectionsUrl({
          name: entry.subjectName,
          latitude: payloadNumber(entry.payload, 'latitude'),
          longitude: payloadNumber(entry.payload, 'longitude'),
          roadAddress: address,
        })}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${entry.subjectName} 길찾기`}
      >
        길찾기
      </a>
    </li>
  );
}

export default function RankBoardPage() {
  useHeritageSurface();
  const { slug = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ranking', 'board', slug],
    queryFn: () => fetchRankingBoard(slug),
    enabled: slug.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useSeo(data ? rankBoardMeta(data) : { title: '랭킹', description: '' });
  const captured = capturedLabel(data?.capturedAt ?? null);

  return (
    <div className="rank-page">
      <header className="rank-header">
        <div className="rank-header__bar">
          <Link className="rank-header__brand kh-display" to="/">
            ← 랭킹
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="rank-header__title kh-display">{data?.title ?? '리더보드'}</h1>
        {data?.subtitle && <p className="rank-header__subtitle">{data.subtitle}</p>}
        {captured && <span className="rank-captured kh-mono">{captured}</span>}
      </header>

      <main className="rank-main">
        {isLoading && <p className="rank-state">불러오는 중…</p>}
        {isError && <p className="rank-state kh-status-error">랭킹을 불러오지 못했습니다.</p>}
        {data && data.entries.length === 0 && (
          <p className="rank-state">아직 집계된 순위가 없습니다.</p>
        )}

        {data && data.entries.length > 0 && (
          <ol className="rank-list">
            {data.entries.map((entry) => (
              <EntryRow key={entry.subjectKey} entry={entry} unit={data.unit} />
            ))}
          </ol>
        )}
      </main>

      <Footer>
        <p>{data?.sourceLabel ? `출처: ${data.sourceLabel}` : RANK_GAS_SOURCE}</p>
      </Footer>
    </div>
  );
}
