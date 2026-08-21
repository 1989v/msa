import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  StarRating,
  StarRatingInput,
  halvesFromStars,
  quantizeHalfStars,
  starsFromHalves,
} from '../StarRating';

describe('별점 척도 변환 (BE halves 1~10 ↔ 별 0.5~5)', () => {
  it('halves → 별은 절반이다', () => {
    expect(starsFromHalves(1)).toBe(0.5);
    expect(starsFromHalves(7)).toBe(3.5);
    expect(starsFromHalves(10)).toBe(5);
  });

  it('별 → halves 왕복이 전 구간에서 맞다', () => {
    for (let halves = 1; halves <= 10; halves++) {
      expect(halvesFromStars(starsFromHalves(halves))).toBe(halves);
    }
  });

  it('표시 칸은 반개 단위로 반올림한다', () => {
    expect(quantizeHalfStars(4.3)).toBe(4.5); // 평균 8.6/2
    expect(quantizeHalfStars(4.2)).toBe(4.0);
    expect(quantizeHalfStars(0)).toBe(0);
    expect(quantizeHalfStars(5)).toBe(5);
  });
});

describe('StarRating (표시)', () => {
  it('값을 접근 가능한 라벨과 반개 반올림된 채움 폭으로 그린다', () => {
    const { container } = render(<StarRating value={4.3} />);
    expect(screen.getByRole('img', { name: '4.3 / 5' })).toBeInTheDocument();
    const fill = container.querySelector<HTMLElement>('.star-rating-fill');
    expect(fill?.style.width).toBe('90%'); // 4.5칸 / 5칸
  });
});

describe('StarRatingInput (입력)', () => {
  it('별 5개 × 좌/우 반쪽 = 버튼 10개, 반쪽이 halves 값에 대응한다', () => {
    const onRate = vi.fn();
    render(<StarRatingInput halves={null} onRate={onRate} lang="ko" />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: '3.5점 주기' }));
    expect(onRate).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByRole('button', { name: '5점 주기' }));
    expect(onRate).toHaveBeenCalledWith(10);
  });

  it('선택한 반쪽에 aria-pressed 가 붙는다', () => {
    render(<StarRatingInput halves={7} onRate={() => undefined} lang="ko" />);
    expect(screen.getByRole('button', { name: '3.5점 주기', pressed: true })).toBeInTheDocument();
  });

  it('영문 라벨도 나온다', () => {
    render(<StarRatingInput halves={null} onRate={() => undefined} lang="en" />);
    expect(screen.getByRole('button', { name: 'Rate 0.5 out of 5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate 5 out of 5' })).toBeInTheDocument();
  });
});
