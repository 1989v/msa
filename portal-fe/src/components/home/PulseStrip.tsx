import { useQuery } from '@tanstack/react-query';
import { listGames } from '../../api/gameApi';
import './Home.css';

/**
 * 지금 이 순간 — 살아 있는 숫자. 전부 이미 있는 공개 API 의 응답값이라 새 백엔드가 없다.
 * 로드된 실제 값은 애니메이션이나 관측 콜백을 기다리지 않고 바로 표시한다.
 */

/** Public statistics must show their loaded value even when rAF/observers stall. */
function Figure({ value, unit, label }: { value: number | null; unit: string; label: string }) {
  return (
    <div className="pulse-fig">
      <div className="pulse-k">{label}</div>
      <div className="pulse-v">
        {value === null ? '—' : value.toLocaleString('ko-KR')}
        <small>{unit}</small>
      </div>
    </div>
  );
}

export default function PulseStrip({
  openServices,
  openSourceCount,
  yearsInField,
}: {
  openServices: number | null;
  openSourceCount: number | null;
  yearsInField: number | null;
}) {
  const games = useQuery({
    queryKey: ['home', 'games-count'],
    queryFn: () => listGames({ size: 1 }),
    staleTime: 10 * 60_000,
  });
  const gameCount = games.data?.totalElements ?? null;

  return (
    <section className="pulse" aria-label="지금 이 순간">
      <div className="home-inner">
        <div className="pulse-figs">
          <Figure value={openServices} unit="개" label="운영 중인 서비스" />
          <Figure value={gameCount} unit="종" label="플레이할 수 있는 웹게임" />
          <Figure value={openSourceCount} unit="개" label="공개 저장소" />
          <Figure value={yearsInField} unit="년차" label="백엔드 경력" />
        </div>
        <div className="kh-mono pulse-note">공개 API 응답값 — display/services · games · display/open-source · portfolio/timeline</div>
      </div>
    </section>
  );
}
