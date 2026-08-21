import { useCallback, useEffect, useRef, useState } from 'react';
import './GatedCodeSnippet.css';

/**
 * 하우스 광고 인터스티셜 — 외부 광고망 없이 자체 서비스를 소개한다 (ADR-0059 의 HOUSE 결).
 *
 * 카운트다운이 끝나야 보상(잠금 해제)이 활성화된다. 자동으로 열지 않고 버튼을 눌러
 * 닫게 한 이유: 광고가 끝나는 순간 화면이 저절로 바뀌면 무엇 때문에 열렸는지 읽히지 않는다.
 */
const COUNTDOWN_SECONDS = 5;

/** 정적 하우스 소재 — 전시 서비스 중 외부에서 눌러볼 만한 것들 */
const HOUSE_PROMOS = [
  {
    name: 'K-관광 지도',
    description: '전국 관광지를 국문·영문 지도로 — TourAPI 원천 데이터',
    href: 'https://place.1989v.com',
  },
  {
    name: '웹 게임',
    description: '설치 없이 브라우저에서 바로 하는 게임들',
    href: 'https://1989v.com/games',
  },
  {
    name: '기술 블로그',
    description: '이 플랫폼을 만들며 내린 설계 판단의 기록',
    href: 'https://blog.1989v.com',
  },
];

export default function HouseAdInterstitial({
  onDone,
  onClose,
}: {
  /** 카운트다운 종료 후 사용자가 보상을 수령했을 때 */
  onDone: () => void;
  /** 중도 이탈 — 보상 없음 */
  onClose: () => void;
}) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const done = remaining <= 0;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, done]);

  // 포커스를 오버레이 안에 가둔다 — ProjectDialog 와 같은 이유(탭이 뒤 페이지로 새면 길을 잃는다)
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <div className="premium-ad-veil" onClick={onClose}>
      <div
        ref={panelRef}
        className="premium-ad"
        role="dialog"
        aria-modal="true"
        aria-label="잠금 해제 광고"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="premium-ad-head">
          <span className="kh-seal kh-seal-ink">
            <span className="kh-seal-dot" aria-hidden="true" />
            House AD
          </span>
          <button ref={closeRef} type="button" className="premium-ad-close" onClick={onClose}>
            닫기 <span aria-hidden="true">✕</span>
          </button>
        </div>

        <p className="premium-ad-lead">
          이 포트폴리오의 주인이 만든 서비스들입니다. 잠깐 둘러보는 동안 코드가 열립니다.
        </p>

        <ul className="premium-ad-promos">
          {HOUSE_PROMOS.map((promo) => (
            <li key={promo.name}>
              <a href={promo.href} target="_blank" rel="noopener noreferrer">
                <strong>{promo.name}</strong>
                <span>{promo.description}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="premium-ad-foot">
          <span className="premium-ad-count" aria-live="polite">
            {done ? '준비 완료' : `${remaining}초 후 열립니다`}
          </span>
          <button
            type="button"
            className="premium-lock-btn premium-lock-btn-primary"
            disabled={!done}
            onClick={onDone}
          >
            코드 전체 보기
          </button>
        </div>
      </div>
    </div>
  );
}
