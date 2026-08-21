import { useState } from 'react';
import type { GameLang } from '../../api/gameApi';

/**
 * 별점 척도 변환 — 백엔드는 1~10 정수(반개=1), 화면은 별 0.5~5.
 * BE 척도는 바꾸지 않는다: API 의 score/ratingAvg 는 그대로 halves 축이다.
 */
export function starsFromHalves(halves: number): number {
  return halves / 2;
}

export function halvesFromStars(stars: number): number {
  return Math.round(stars * 2);
}

/** 칸은 반개 단위로만 채운다 — 평균 4.3 은 4.5칸으로 반올림해 찍는다 */
export function quantizeHalfStars(stars: number): number {
  return Math.round(stars * 2) / 2;
}

/**
 * 읽기 전용 별점 행. 같은 글리프 두 겹을 겹치고 위 겹의 폭을 %로 잘라 반개를 그린다 —
 * ★/☆ 는 폰트에 따라 폭이 달라 섞으면 어긋난다. 색은 currentColor: 놓인 자리가 정한다.
 */
export function StarRating({ value, label }: { value: number; label?: string }) {
  const filled = Math.max(0, Math.min(5, quantizeHalfStars(value)));
  return (
    <span className="star-rating" role="img" aria-label={label ?? `${value.toFixed(1)} / 5`}>
      <span className="star-rating-track" aria-hidden>
        ★★★★★
      </span>
      <span className="star-rating-fill" aria-hidden style={{ width: `${(filled / 5) * 100}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

const STARS = [1, 2, 3, 4, 5];

function rateLabel(halves: number, lang: GameLang): string {
  const stars = String(starsFromHalves(halves));
  return lang === 'en' ? `Rate ${stars} out of 5` : `${stars}점 주기`;
}

/**
 * 별점 입력 — 별 5개, 별마다 좌/우 반쪽 히트존이 halves 1..10 에 대응한다.
 * 셀은 44×44 로 터치 표준을 지키고, 시각적 별은 그 안에 작게 놓인다.
 */
export function StarRatingInput({
  halves,
  onRate,
  lang,
}: {
  halves: number | null;
  onRate: (halves: number) => void;
  lang: GameLang;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? halves ?? 0;

  return (
    <div className="star-input" onMouseLeave={() => setHover(null)}>
      {STARS.map((star) => {
        const leftHalves = star * 2 - 1;
        const rightHalves = star * 2;
        const fill = shown >= rightHalves ? '100%' : shown === leftHalves ? '50%' : null;
        return (
          <span key={star} className="star-input-cell">
            <span className="star-input-glyph" aria-hidden>
              <span className="star-input-track">★</span>
              {fill && (
                <span className="star-input-fill" style={{ width: fill }}>
                  ★
                </span>
              )}
            </span>
            {[leftHalves, rightHalves].map((h) => (
              <button
                key={h}
                type="button"
                className={`star-input-half ${h === leftHalves ? 'is-left' : 'is-right'}`}
                aria-label={rateLabel(h, lang)}
                aria-pressed={halves === h}
                onClick={() => onRate(h)}
                onMouseEnter={() => setHover(h)}
                onFocus={() => setHover(h)}
                onBlur={() => setHover(null)}
              />
            ))}
          </span>
        );
      })}
    </div>
  );
}
