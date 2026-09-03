import { useEffect, useState, type RefObject } from 'react';
import { useCoarsePointer, useDispenser } from './useDispenser';
import '../../lib/card-dispenser/card-dispenser.css';
import './dispenser.css';

export type DispenserSkin = 'hanji' | 'arcade' | 'paper';

export interface DispenserStageProps<T> {
  items: T[];
  render: (item: T, index: number) => string;
  onChange?: (item: T, index: number) => void;
  /** 일어난 정면 카드를 탭·클릭·Enter 했을 때 — 링크로 보낸다 */
  onActivate?: (item: T) => void;
  /** 스핀이 멈추고 하나가 섰을 때 */
  onPicked?: (item: T) => void;
  minCards?: number;
  skin?: DispenserSkin;
  label: string;
  /** 판 아래 한 줄 — 왼쪽(출처) · 오른쪽(개수 등) */
  caption: [string, string];
  pickLabel: string;
  /**
   * 스크롤 스크럽 대상. 이 요소가 화면을 지나는 동안 sweep 도만큼 돈다.
   * 터치 기기에서는 무시한다 — 판은 멈춰 있고 뽑기가 돌린다.
   */
  scrubRef?: RefObject<HTMLElement | null>;
  sweep?: number;
  /** 시트 안에서 열리자마자 한 번 돌릴 때 */
  spinOnMount?: boolean;
}

/**
 * 판(.kh-slab) 위의 카드 디스펜서 + 뽑기 버튼 + 캡션. 메인 서비스 섹션과 뽑기 시트가 같이 쓴다.
 */
export default function DispenserStage<T>({
  items,
  render,
  onChange,
  onActivate,
  onPicked,
  minCards,
  skin = 'hanji',
  label,
  caption,
  pickLabel,
  scrubRef,
  sweep = 110,
  spinOnMount = false,
}: DispenserStageProps<T>) {
  const { hostRef, apiRef } = useDispenser({ items, render, onChange, onActivate, minCards, label });
  const coarse = useCoarsePointer();
  const [spinning, setSpinning] = useState(false);

  // 스크롤 스크럽 — 데스크탑에서만
  useEffect(() => {
    const target = scrubRef?.current;
    if (!target || coarse) return;
    let raf = 0;
    const scrub = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const api = apiRef.current;
        if (!api) return;
        const r = target.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
        api.setAngle(-p * sweep);
      });
    };
    window.addEventListener('scroll', scrub, { passive: true });
    window.addEventListener('resize', scrub);
    scrub();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', scrub);
      window.removeEventListener('resize', scrub);
    };
  }, [scrubRef, coarse, sweep, apiRef, items]);

  const spin = () => {
    const api = apiRef.current;
    if (!api || spinning) return;
    setSpinning(true);
    void api.spinTo('random').then((item) => {
      setSpinning(false);
      onPicked?.(item);
    });
  };

  useEffect(() => {
    if (!spinOnMount || items.length === 0) return;
    // 판이 서고 한 박자 뒤에 돈다 — 열리자마자 돌면 시트 등장과 겹쳐 무엇이 움직이는지 안 보인다
    const t = window.setTimeout(spin, 320);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinOnMount, items]);

  return (
    <div className="kh-slab-offset dsp-offset">
      <div className="kh-slab kh-grain dsp-stage">
        <div ref={hostRef} className={`dsp-host dsp-host--${skin}`} />
        <button type="button" className="dsp-btn kh-mono kh-press" onClick={spin} disabled={spinning}>
          {pickLabel} <span aria-hidden="true">↻</span>
        </button>
        <div className="kh-mono dsp-cap">
          <span>{caption[0]}</span>
          <span>{caption[1]}</span>
        </div>
      </div>
    </div>
  );
}
