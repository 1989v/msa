import { useEffect, useRef, useState } from 'react';
import type { GraphStats } from '../types/graph';
import './HeroSection.css';

interface HeroSectionProps {
  stats: GraphStats;
  serviceCount: number;
}

function AnimatedCounter({ target, label }: { target: number; label: string }) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

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
          실제 프로젝트 코드에서 추출한 개념을 3D 그래프로 탐색하세요
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
