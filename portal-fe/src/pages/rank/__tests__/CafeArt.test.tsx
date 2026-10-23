import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CafeCup, cafeCupTone } from '../CafeArt';
import { cafeDrinkImage, cafeDrinkImages } from '../cafeDrinkImages';
describe('local cafe cup palette', () => {
  it.each([['아메리카노', '커피', 'coffee'], ['카페라떼', '라떼', 'cream'], ['레몬에이드', '에이드', 'yellow'], ['청포도', '에이드', 'yellow'], ['요거트', '스무디·프라페', 'fruit'], ['딸기라떼', '라떼', 'fruit'], ['망고스무디', '스무디·프라페', 'yellow'], ['말차라떼', '라떼', 'tea']])('%s uses %s group tone %s', (name, group, tone) => expect(cafeCupTone(name, group)).toBe(tone));
});

describe('generated cafe drink art', () => {
  it.each([
    ['아메리카노', '아메리카노', 'americano'], ['에스프레소', '에스프레소', 'americano'],
    ['콜드브루', '콜드브루', 'americano'], ['라떼', '라떼', 'cafe-latte'],
    ['카푸치노', '카푸치노', 'cafe-latte'], ['바닐라라떼', '바닐라라떼', 'vanilla-latte'],
    ['카페모카', '카페모카', 'cafe-mocha'], ['초코', '초코', 'cafe-mocha'],
    ['카라멜마끼아또', '카라멜마끼아또', 'caramel-macchiato'],
    ['고구마라떼', '고구마라떼', 'sweet-potato-latte'], ['말차', '말차·녹차라떼', 'matcha-latte'],
    ['녹차라떼', '말차·녹차라떼', 'matcha-latte'], ['밀크티', '밀크티', 'cafe-latte'],
    ['우유', '우유·요거트', 'cafe-latte'], ['요거트', '우유·요거트', 'cafe-latte'],
    ['티', '티', 'iced-tea'], ['에이드', '에이드', 'lemon-ade'], ['콜라', '탄산음료', 'lemon-ade'],
    ['스무디', '스무디·프라페', 'frappe'], ['프라페', '스무디·프라페', 'frappe'],
    ['주스', '주스', 'orange-juice'], ['기타', '기타', 'cafe-latte'],
    ['새 메뉴', '', 'cafe-latte'], ['바닐라라떼', '', 'vanilla-latte'], ['고구마라떼', '', 'sweet-potato-latte'],
  ])('%s in %s uses %s', (name, group, image) => {
    expect(cafeDrinkImage(name, group)).toBe(cafeDrinkImages[image as keyof typeof cafeDrinkImages]);
  });

  it.each(['라떼', '스무디·프라페', '주스', '티', '기타'])('strawberry names override %s', group => {
    expect(cafeDrinkImage('딸기 음료', group)).toBe(cafeDrinkImages['strawberry-latte']);
  });

  it('uses decorative, sized lazy images and eager loading for prominent art', () => {
    const { container, rerender } = render(<CafeCup name="바닐라라떼" />);
    const image = container.querySelector('img')!;
    expect(image).toHaveAttribute('src', '/cafe/drinks/vanilla-latte.webp');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('aria-hidden', 'true');
    expect(image).toHaveAttribute('width', '512');
    expect(image).toHaveAttribute('height', '512');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    rerender(<CafeCup name="바닐라라떼" eager />);
    expect(image).toHaveAttribute('loading', 'eager');
  });

  it('falls back on load errors and loads a different recipe after navigation', () => {
    const { container, rerender } = render(<CafeCup name="아메리카노" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg.cafe-cup')).toHaveAttribute('aria-hidden', 'true');
    rerender(<CafeCup name="딸기라떼" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/cafe/drinks/strawberry-latte.webp');
  });
});
