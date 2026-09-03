import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listGames } from '../../api/gameApi';
import './Home.css';

/**
 * 지금 이 순간 — 살아 있는 숫자. 전부 이미 있는 공개 API 의 응답값이라 새 백엔드가 없다.
 * 카운트업은 첫 노출 1회, reduced-motion 이면 최종값 그대로다.
 */

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

function Figure({ value, unit, label }: { value: number | null; unit: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // 화면에 들어온 뒤 0 → value 로 센다. 값이 오기 전·모션 축소는 이 상태를 쓰지 않는다
  const [counted, setCounted] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (value === null || !el || reducedMotion()) return;
    let raf = 0;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      const t0 = performance.now();
      const dur = 900;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setCounted(Math.round(value * e));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    // 앵커 점프로 띠를 건너뛰면 IO 는 한 번도 안 울린다 — 이미 지나쳤으면 그냥 센다
    const onScroll = () => {
      if (el.getBoundingClientRect().bottom < 0) start();
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting || e.boundingClientRect.bottom < 0)) start();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [value]);

  const shown = value === null ? null : reducedMotion() ? value : (counted ?? 0);

  return (
    <div className="pulse-fig" ref={ref}>
      <div className="pulse-k">{label}</div>
      <div className="pulse-v">
        {shown === null ? '—' : shown.toLocaleString('ko-KR')}
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
