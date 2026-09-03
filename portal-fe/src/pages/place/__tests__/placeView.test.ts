import type { Attraction } from '../../../api/placeApi';
import { describe, expect, it } from 'vitest';
import { groupByCategory, mergePages, nextPage, titleParts } from '../placeView';

describe('nextPage — 무한 스크롤 페이지 전개', () => {
  it('다음 페이지가 있으면 +1', () => {
    expect(nextPage(0, 3)).toBe(1);
    expect(nextPage(1, 3)).toBe(2);
  });

  it('마지막 페이지면 null — 센티널·버튼이 더 요청하지 않는다', () => {
    expect(nextPage(2, 3)).toBeNull();
    expect(nextPage(0, 1)).toBeNull();
  });

  it('결과가 없으면(totalPages 0) null', () => {
    expect(nextPage(0, 0)).toBeNull();
  });
});

describe('mergePages — 모바일 누적', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };

  it('0페이지는 새 검색 — 통째로 교체한다', () => {
    expect(mergePages([a, b], [c], 0)).toEqual([c]);
  });

  it('이후 페이지는 뒤에 붙인다', () => {
    expect(mergePages([a], [b, c], 1)).toEqual([a, b, c]);
  });

  it('검색 도중 문서가 밀려 같은 id 가 두 페이지에 걸치면 한 번만 남는다', () => {
    expect(mergePages([a, b], [b, c], 1)).toEqual([a, b, c]);
  });

  it('전부 중복이면 기존 배열 참조를 그대로 돌려준다 — 불필요한 리렌더가 없다', () => {
    const prev = [a, b];
    expect(mergePages(prev, [a, b], 1)).toBe(prev);
  });
});

describe('titleParts — 표시명/원어 병기명 분리', () => {
  it('titleLocal 이 있으면 보조명으로 낸다', () => {
    expect(titleParts({ title: 'Dosan Park', titleLocal: '도산공원' })).toEqual({
      primary: 'Dosan Park',
      secondary: '도산공원',
    });
  });

  it('필드가 없는 구 응답에서도 동작한다 — 보조명 없이', () => {
    expect(titleParts({ title: '경복궁' })).toEqual({ primary: '경복궁', secondary: null });
  });

  it('null·빈 문자열·공백은 보조명이 아니다', () => {
    expect(titleParts({ title: '경복궁', titleLocal: null }).secondary).toBeNull();
    expect(titleParts({ title: '경복궁', titleLocal: '' }).secondary).toBeNull();
    expect(titleParts({ title: '경복궁', titleLocal: '  ' }).secondary).toBeNull();
  });

  it('주 표시명과 같은 값이면 중복 표기하지 않는다', () => {
    expect(titleParts({ title: '경복궁', titleLocal: '경복궁' }).secondary).toBeNull();
  });
});

describe('groupByCategory', () => {
  const at = (id: number, category: string) =>
    ({ id: String(id), title: `t${id}`, category }) as unknown as Attraction;

  it('유형끼리 붙여 놓는다 — 섞여 들어와도 한 유형이 이어진다', () => {
    const out = groupByCategory(
      [at(1, 'shopping'), at(2, 'food'), at(3, 'shopping'), at(4, 'food')],
      6,
    );
    expect(out.map((a) => a.category)).toEqual(['shopping', 'shopping', 'food', 'food']);
  });

  it('많은 유형이 앞에 온다 — 순서를 고정하면 먹자골목에서도 쇼핑이 먼저 온다', () => {
    const out = groupByCategory(
      [at(1, 'shopping'), at(2, 'food'), at(3, 'food'), at(4, 'food')],
      6,
    );
    expect(out[0].category).toBe('food');
  });

  it('유형당 상한을 지킨다 — 한 유형이 캐로셀을 다 먹지 않는다', () => {
    const many = Array.from({ length: 20 }, (_, i) => at(i, 'shopping'));
    const out = groupByCategory([...many, at(99, 'food')], 6);
    expect(out.filter((a) => a.category === 'shopping')).toHaveLength(6);
    expect(out.filter((a) => a.category === 'food')).toHaveLength(1);
  });

  it('유형 안에서는 들어온 순서(거리순)를 유지한다', () => {
    const out = groupByCategory([at(1, 'food'), at(2, 'food'), at(3, 'food')], 2);
    expect(out.map((a) => a.id)).toEqual(['1', '2']);
  });

  it('빈 입력은 빈 결과 — 섹션 자체가 안 그려지는 근거가 된다', () => {
    expect(groupByCategory([], 6)).toEqual([]);
  });
});
