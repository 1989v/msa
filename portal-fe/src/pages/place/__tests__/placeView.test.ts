import { describe, expect, it } from 'vitest';
import { mergePages, nextPage, titleParts } from '../placeView';

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
