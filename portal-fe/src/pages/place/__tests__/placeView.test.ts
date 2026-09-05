import type { Attraction } from '../../../api/placeApi';
import { describe, expect, it } from 'vitest';
import {
  groupByCategory,
  INTRO_DERIVED_CONCEPTS,
  INTRO_LABELS,
  introBaseKey,
  introRows,
  isPlottable,
  mergePages,
  nextPage,
  titleParts,
} from '../placeView';

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

describe('isPlottable', () => {
  it('원천이 준 한반도 밖 좌표를 거른다 — 실제 사례', () => {
    // TourAPI 계남근린공원(2611568): 주소는 서울 양천구인데 좌표는 대만·필리핀 사이 바다
    expect(isPlottable(19.69442748, 117.9925662504)).toBe(false);
    // 같은 이름·같은 주소의 정상 레코드(3428372)
    expect(isPlottable(37.5098751207, 126.8550905317)).toBe(true);
  });

  it('좌표 없음(0,0)도 거른다 — 아프리카 앞바다에 핀이 선다', () => {
    expect(isPlottable(0, 0)).toBe(false);
  });

  it('극점은 통과시킨다 — 범위를 좁히면 진짜 관광지가 지도에서 사라진다', () => {
    expect(isPlottable(33.06, 126.27)).toBe(true);   // 마라도
    expect(isPlottable(37.24, 131.87)).toBe(true);   // 독도
    expect(isPlottable(37.96, 124.61)).toBe(true);   // 백령도
    expect(isPlottable(38.6, 128.4)).toBe(true);     // 고성
  });

  it('없거나 숫자가 아니면 거른다', () => {
    expect(isPlottable(null, 127)).toBe(false);
    expect(isPlottable(37.5, undefined)).toBe(false);
    expect(isPlottable(Number.NaN, 127)).toBe(false);
  });
});

describe('introBaseKey', () => {
  it('관광 타입 접미사를 떼어 개념 하나로 모은다', () => {
    expect(introBaseKey('usetime')).toBe('usetime');
    expect(introBaseKey('usetimeculture')).toBe('usetime');
    expect(introBaseKey('usetimeleports')).toBe('usetime');
    expect(introBaseKey('restdatefood')).toBe('restdate');
    expect(introBaseKey('infocentershopping')).toBe('infocenter');
  });

  it('chk* 는 접미사가 개념의 일부다 — 떼면 안 된다', () => {
    expect(introBaseKey('chkbabycarriage')).toBe('chkbabycarriage');
    expect(introBaseKey('chkbabycarriageculture')).toBe('chkbabycarriage');
    expect(introBaseKey('chkcreditcardleports')).toBe('chkcreditcard');
  });
});

describe('introRows', () => {
  // 원천에서 실제로 관측된 키들 (2026-09-05, 5개 타입 표본)
  const RAW = JSON.stringify({
    contentid: '2800664', contenttypeid: '12',
    usetime: '09:00~18:00',            // 파생이 이미 보여 준다 → 중복 금지
    restdateculture: '연중무휴',        // 〃
    lcnsno: '20000199503',             // 내부 번호
    heritage1: '0', heritage2: '1', heritage3: '0',
    expguide: '동물/식물 생태 관찰 체험',
    spendtime: '약 4시간',
    chkcreditcardfood: '가능',
    firstmenu: '삼계탕',
    chkbabycarriageculture: '불가',
    kidsfacility: '0',
    unknownfuturefield: '무언가',       // 라벨 없는 새 필드
  });

  it('파생 컬럼이 보여 주는 개념에는 라벨을 달지 않는다 — 달면 같은 값이 두 줄로 나온다', () => {
    const overlap = INTRO_DERIVED_CONCEPTS.filter((c) => c in INTRO_LABELS);
    expect(overlap).toEqual([]);
  });

  it('파생이 보여 주는 것과 식별자는 빼고 나머지를 낸다', () => {
    const keys = introRows(RAW, 'ko').map((r) => r.key);
    expect(keys).not.toContain('usetime');
    expect(keys).not.toContain('restdate');
    expect(keys).not.toContain('contentid');
    expect(keys).not.toContain('lcnsno');
    expect(keys).toEqual(expect.arrayContaining(['expguide', 'spendtime', 'chkcreditcard']));
  });

  it('타입 접미사가 달라도 개념 하나로 합쳐 라벨을 붙인다', () => {
    const row = introRows(RAW, 'ko').find((r) => r.key === 'chkbabycarriage');
    expect(row?.label).toBe('유모차 대여');
    expect(row?.value).toBe('불가');
  });

  it('heritage 는 지정된 것(1)만 한 줄로 — 0 은 정보가 아니다', () => {
    const rows = introRows(RAW, 'ko').filter((r) => r.key === 'heritage');
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('지정');
    expect(introRows(JSON.stringify({ heritage1: '0' }), 'ko')).toHaveLength(0);
  });

  it('라벨 없는 새 필드는 내지 않는다 — 원천 키 이름을 라벨로 쓰면 안 보여주느니만 못하다', () => {
    expect(introRows(RAW, 'ko').map((r) => r.key)).not.toContain('unknownfuturefield');
  });

  it('영문은 영문 라벨', () => {
    expect(introRows(RAW, 'en').find((r) => r.key === 'spendtime')?.label).toBe('Time needed');
  });

  it('원문이 깨져 있거나 없으면 빈 목록 — 화면은 살아야 한다', () => {
    expect(introRows('{not json', 'ko')).toEqual([]);
    expect(introRows(null, 'ko')).toEqual([]);
    expect(introRows(undefined, 'ko')).toEqual([]);
  });
});
