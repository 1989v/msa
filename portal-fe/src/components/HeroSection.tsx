import { useEffect, useState } from 'react';
import type { GraphStats } from '../types/graph';
import './HeroSection.css';

interface HeroSectionProps {
  stats: GraphStats;
  serviceCount: number;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function AnimatedCounter({ target, label }: { target: number; label: string }) {
  // 모션 축소 설정이면 카운트업 없이 최종값으로 시작한다
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  // startedRef 가드는 StrictMode 이중 실행에서 인터벌이 영영 안 도는 버그가 있었다 —
  // cleanup 이 인터벌을 정리하므로 가드 없이 재실행해도 안전하다.
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const duration = 1200;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), target);
      setValue(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [target]);

  return (
    <div className="hero-counter">
      <span className="hero-counter-value">{value.toLocaleString()}</span>
      <span className="hero-counter-label">{label}</span>
    </div>
  );
}

export default function HeroSection({ stats, serviceCount }: HeroSectionProps) {
  return (
    <div className="hero-section">
      <div className="hero-inner">
        <h1 className="hero-tagline">코드로 배우는 IT 개념 사전</h1>
        <p className="hero-subtitle">
          실제 프로젝트 코드에서 추출한 개념을 도메인 맵으로 드릴다운하세요
        </p>
        <div className="hero-counters">
          <AnimatedCounter target={stats.totalConcepts} label="Concepts" />
          <div className="hero-counter-divider" />
          <AnimatedCounter target={serviceCount} label="Services" />
          <div className="hero-counter-divider" />
          <AnimatedCounter target={stats.totalIndexes} label="Code Refs" />
        </div>
      </div>
    </div>
  );
}
