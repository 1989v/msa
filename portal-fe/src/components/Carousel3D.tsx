import { useState, type ReactNode } from 'react';
import './Carousel3D.css';

interface CarouselPanel {
  key: string;
  label: string;
  content: ReactNode;
  preview: ReactNode;
}

interface Carousel3DProps {
  panels: CarouselPanel[];
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
}

export default function Carousel3D({ panels, activeIndex: controlledIndex, onActiveChange }: Carousel3DProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIdx = controlledIndex ?? internalIndex;

  const setActive = (idx: number) => {
    const clamped = ((idx % panels.length) + panels.length) % panels.length;
    setInternalIndex(clamped);
    onActiveChange?.(clamped);
  };

  const getSlideClass = (index: number) => {
    if (index === activeIdx) return 'active';
    const prev = ((activeIdx - 1) + panels.length) % panels.length;
    const next = (activeIdx + 1) % panels.length;
    if (index === prev) return 'prev';
    if (index === next) return 'next';
    return 'hidden';
  };

  return (
    <div className="carousel-container">
      <div className="carousel-viewport">
        {panels.map((panel, index) => {
          const slideClass = getSlideClass(index);
          return (
            <div
              key={panel.key}
              className={`carousel-slide ${slideClass}`}
              onClick={slideClass !== 'active' && slideClass !== 'hidden' ? () => setActive(index) : undefined}
            >
              {slideClass === 'active' ? panel.content : panel.preview}
            </div>
          );
        })}
      </div>

      <div className="carousel-indicators">
        {panels.map((_, i) => (
          <button
            key={i}
            className={`carousel-dot ${i === activeIdx ? 'active' : ''}`}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}
