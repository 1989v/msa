import type { Attraction } from '../../../api/placeApi';
import { campingRows, placeSourceLine, visitSummary } from '../placeAttributes';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOBILE_LAYOUT,
  INTRO_DERIVED_CONCEPTS,
  INTRO_LABELS,
  activeFilterCount,
  galleryImages,
  groupByCategory,
  introBaseKey,
  introRows,
  isPlottable,
  mergePages,
  nextPage,
  overviewText,
  parseLinks,
  parseMobileLayout,
  relaxConditions,
  repeatInfoRows,
  sourceText,
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

describe('overviewText', () => {
  it('영문 개요의 <br> 과 엔티티를 푼다 — 지금은 글자로 보이고 있었다', () => {
    // 라이브 실측값 (place.1989v.com/en/attractions/1652)
    const raw = '◎ Travel information to meet Hallyu&rsquo;s charm<br /><br />Youngchive Seongsu is the studio';
    const out = overviewText(raw);
    expect(out).not.toMatch(/<br/i);
    expect(out).not.toMatch(/&[a-z]+;/i);
    expect(out).toContain('Hallyu’s charm');
    expect(out).toContain('charm\n\nYoungchive');
  });

  it('국문의 \n 은 그대로 남긴다 — 화면이 pre-line 으로 살린다', () => {
    expect(overviewText('첫 줄\n둘째 줄')).toBe('첫 줄\n둘째 줄');
  });

  it('빈 줄이 겹쳐 와도 하나까지만', () => {
    expect(overviewText('가<br /><br /><br /><br />나')).toBe('가\n\n나');
  });

  it('br 이 아닌 태그는 지운다 — 원천 HTML 을 살려 주지 않는다', () => {
    expect(overviewText('<div class="text202503"><b>굵게</b> 그리고 <em>기울임</em></div>'))
      .toBe('굵게 그리고 기울임');
  });

  it('&lt; &gt; &amp; 는 글자로 되돌린다', () => {
    expect(overviewText('&lt;가&gt; &amp; 나')).toBe('<가> & 나');
  });

  it('숫자 엔티티도 푼다. 제어문자는 되돌리지 않는다', () => {
    expect(overviewText('&#48124;&#44397;')).toBe('민국');   // U+BBFC, U+AD6D
    expect(overviewText('가&#7;나')).toBe('가나');
  });

  it('모르는 엔티티는 건드리지 않는다 — 지어내는 것보다 그대로가 낫다', () => {
    expect(overviewText('&zzz; 남음')).toBe('&zzz; 남음');
  });

  it('없으면 빈 문자열 — 호출자가 블록을 안 그린다', () => {
    expect(overviewText(null)).toBe('');
    expect(overviewText(undefined)).toBe('');
    expect(overviewText('   ')).toBe('');
  });
});

describe('sourceText — 이용정보에도 같은 정리가 필요하다', () => {
  it('문의처의 <br> 로 줄을 나눈다 (라이브 실측값)', () => {
    // GET /api/search/attractions/10447 의 infoCenter 원문
    const raw = '제주도 지질공원 064-710-3945<br>세계유산본부 064-710-6027';
    expect(sourceText(raw)).toBe('제주도 지질공원 064-710-3945\n세계유산본부 064-710-6027');
  });

  it('overviewText 와 같은 함수다 — 두 벌이면 한쪽만 고쳐진다', () => {
    expect(sourceText).toBe(overviewText);
  });

  it('이용시간의 엔티티도 푼다', () => {
    expect(sourceText('09:00&ndash;18:00')).toBe('09:00–18:00');
  });
});

describe('galleryImages — 부가 사진', () => {
  const raw = JSON.stringify([
    { originimgurl: 'https://t/1.jpg', smallimageurl: 'https://t/1s.jpg', imgname: '정문' },
    { originimgurl: 'http://t/2.JPG', imgname: '' },
    { smallimageurl: 'https://t/3.jpg', imgname: '뒤뜰' },   // 원본이 없으면 작은 것을 쓴다
  ]);

  it('대표사진이 맨 앞에 오고 원문이 뒤따른다', () => {
    const got = galleryImages(raw, 'https://t/main.jpg');
    expect(got.map((g) => g.url)).toEqual([
      'https://t/main.jpg', 'https://t/1.jpg', 'http://t/2.JPG', 'https://t/3.jpg',
    ]);
    expect(got[1].name).toBe('정문');
  });

  it('대표사진이 원문에도 있으면 한 번만 나온다', () => {
    const got = galleryImages(raw, 'https://t/1.jpg');
    expect(got.filter((g) => g.url.endsWith('/1.jpg'))).toHaveLength(1);
    expect(got[0].url).toBe('https://t/1.jpg');
  });

  it('프로토콜만 다른 같은 사진도 중복으로 본다', () => {
    // 원천이 http/https 를 섞어 준다 — 프로토콜로 갈리면 같은 사진이 두 번 걸린다
    const got = galleryImages(raw, 'https://t/2.JPG');
    expect(got.filter((g) => g.url.toLowerCase().endsWith('/2.jpg'))).toHaveLength(1);
  });

  it('원문이 깨져 있어도 대표사진은 남는다', () => {
    expect(galleryImages('{not json', 'https://t/main.jpg')).toEqual([
      { url: 'https://t/main.jpg', name: '' },
    ]);
  });

  it('사진이 하나도 없으면 빈 배열', () => {
    expect(galleryImages(null, null)).toEqual([]);
  });
});

describe('repeatInfoRows — 반복정보', () => {
  it('라벨은 원천의 infoname 을 그대로 쓴다', () => {
    // 번역표를 두면 원천이 항목을 늘릴 때마다 화면에서 조용히 사라진다
    const rows = repeatInfoRows(JSON.stringify([
      { infoname: '내국인예약안내', infotext: '가능', serialnum: '10' },
      { infoname: '코스안내', infotext: '북지장사 가는 길', serialnum: '0' },
    ]));
    expect(rows.map((r) => r.label)).toEqual(['코스안내', '내국인예약안내']);   // serialnum 순
    expect(rows[0].value).toBe('북지장사 가는 길');
  });

  it('이름이나 내용이 비면 줄을 만들지 않는다', () => {
    expect(repeatInfoRows(JSON.stringify([
      { infoname: '', infotext: '가능', serialnum: '1' },
      { infoname: '안내', infotext: '   ', serialnum: '2' },
    ]))).toEqual([]);
  });

  it('같은 이름이 여러 번 와도 각각 남는다', () => {
    // 코스 구간처럼 같은 라벨이 반복되는 유형이 있다 — 합치면 정보가 준다
    const rows = repeatInfoRows(JSON.stringify([
      { infoname: '코스안내', infotext: '1구간', serialnum: '0' },
      { infoname: '코스안내', infotext: '2구간', serialnum: '1' },
    ]));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);   // key 가 겹치면 React 가 하나를 버린다
  });

  it('원문이 깨졌거나 배열이 아니면 빈 배열', () => {
    expect(repeatInfoRows('{not json')).toEqual([]);
    expect(repeatInfoRows(JSON.stringify({ infoname: 'x', infotext: 'y' }))).toEqual([]);
    expect(repeatInfoRows(null)).toEqual([]);
  });
});

describe('parseLinks — 색인이 실어 온 링크', () => {
  it('수집분과 딥링크를 갈라서 준다', () => {
    const raw = JSON.stringify({
      collected: [{ source: 'YOUTUBE', title: '영상', url: 'https://y/1' }],
      deepLinks: [{ provider: 'INSTAGRAM', kind: 'SOCIAL', url: 'https://i/t' }],
    });
    const got = parseLinks(raw);
    expect(got?.collected).toHaveLength(1);
    expect(got?.deepLinks).toHaveLength(1);
  });

  it('대기 상태를 참으로 만들지 않는다', () => {
    // 색인 시점에는 수집 대기 여부를 알 수 없다. true 로 두면 화면이 하루 종일
    // 빈 껍데기 스켈레톤을 그린다.
    expect(parseLinks(JSON.stringify({ collected: [], deepLinks: [] }))?.pending).toBe(false);
  });

  it('한쪽이 없어도 다른 쪽은 그린다', () => {
    // 관광지 95%는 수집분이 없고 딥링크만 있다
    const got = parseLinks(JSON.stringify({ deepLinks: [{ provider: 'YOUTUBE', kind: 'SOCIAL', url: 'u' }] }));
    expect(got?.collected).toEqual([]);
    expect(got?.deepLinks).toHaveLength(1);
  });

  it('원문이 깨졌거나 없으면 null', () => {
    expect(parseLinks('{not json')).toBeNull();
    expect(parseLinks(null)).toBeNull();
    expect(parseLinks(undefined)).toBeNull();
  });
});

describe('campingRows — 고캠핑 원문 중 화면용 키, 서버 렌더 「캠핑장 정보」와 같은 줄', () => {
  it('업종·사이트(0 인 종류 제외)·부대시설·반려동물·운영 기간·운영일·상태 순서로, 쉼표는 띄어 쓴다', () => {
    // 고캠핑 운영 응답(2026-10-07, contentId 8031)에서 place 가 고른 키 — 서버 렌더 테스트와 같은 값
    const raw = JSON.stringify({
      induty: '일반야영장,자동차야영장', gnrlSiteCo: '25', autoSiteCo: '0', glampSiteCo: '3', sbrsCl: '전기,무선인터넷,장작판매',
      animalCmgCl: '가능', operPdCl: '봄,여름,가을,겨울', operDeCl: '평일+주말', manageSttus: '운영',
    });
    expect(campingRows(raw, 'ko')).toEqual([
      { label: '업종', value: '일반야영장, 자동차야영장' },
      { label: '사이트', value: '일반 25 · 글램핑 3' },
      { label: '부대시설', value: '전기, 무선인터넷, 장작판매' },
      { label: '반려동물 동반', value: '가능' },
      { label: '운영 기간', value: '봄, 여름, 가을, 겨울' },
      { label: '운영일', value: '평일+주말' },
      { label: '운영 상태', value: '운영' },
    ]);
  });

  it('없거나 못 읽으면 빈 목록', () => {
    expect(campingRows(null, 'ko')).toEqual([]);
    expect(campingRows('{not json', 'ko')).toEqual([]);
    expect(campingRows('[]', 'ko')).toEqual([]);
  });
});

describe('relaxConditions — 0건 화면의 해제 후보', () => {
  const base = {
    keyword: '', category: null, listEventStatus: null, attributes: new Set<never>(),
    areaCode: null, sidoCode: null, sigunguCode: null, geo: null,
  };

  it('광역(areaCode)과 시도가 둘 다 있으면 지역은 시도 하나 — 질의에 실리는 쪽', () => {
    expect(relaxConditions({ ...base, areaCode: '1', sidoCode: '11' })).toEqual([{ kind: 'region', level: 'sido', code: '11' }]);
    expect(relaxConditions({ ...base, areaCode: '1' })).toEqual([{ kind: 'region', level: 'area', code: '1' }]);
    expect(relaxConditions({ ...base, sidoCode: '11', sigunguCode: '110' })).toEqual([
      { kind: 'region', level: 'sigungu', code: '110' },
    ]);
  });

  it('행사 분류면 속성은 후보가 아니고, 상태는 고른 것만', () => {
    const attributes = new Set(['parking'] as const);
    expect(relaxConditions({ ...base, category: 'festival', attributes })).toEqual([{ kind: 'category', category: 'festival' }]);
    expect(relaxConditions({ ...base, category: 'festival', listEventStatus: 'ONGOING' })).toEqual([
      { kind: 'category', category: 'festival' },
      { kind: 'eventStatus', status: 'ONGOING' },
    ]);
    expect(relaxConditions({ ...base, category: 'nature', listEventStatus: 'ONGOING', attributes })).toEqual([
      { kind: 'category', category: 'nature' },
      { kind: 'attribute', id: 'parking' },
    ]);
  });
});

describe('parseMobileLayout — 좁은 화면 배치 변형', () => {
  it('정확히 listFirst · mapSplit 이면 그 값', () => {
    expect(parseMobileLayout('?layout=listFirst')).toBe('listFirst');
    expect(parseMobileLayout('?layout=mapSplit')).toBe('mapSplit');
    expect(parseMobileLayout('?q=1&layout=mapSplit')).toBe('mapSplit');
  });

  it('없거나 그 밖의 값이면 기본값 — 대소문자·앞뒤 문자도 무효', () => {
    expect(DEFAULT_MOBILE_LAYOUT).toBe('listFirst');
    expect(parseMobileLayout('')).toBe(DEFAULT_MOBILE_LAYOUT);
    expect(parseMobileLayout('?layout=')).toBe(DEFAULT_MOBILE_LAYOUT);
    expect(parseMobileLayout('?layout=mapsplit')).toBe(DEFAULT_MOBILE_LAYOUT);
    expect(parseMobileLayout('?layout=mapSplit%22%3E')).toBe(DEFAULT_MOBILE_LAYOUT);
    expect(parseMobileLayout('?layout=evil')).toBe(DEFAULT_MOBILE_LAYOUT);
  });
});

describe('activeFilterCount — 「필터 N」의 N', () => {
  const base = {
    keyword: '', category: null, listEventStatus: null, attributes: new Set<never>(),
    areaCode: null, sidoCode: null, sigunguCode: null, geo: null,
  };

  it('분류만 고르면 1', () => {
    expect(activeFilterCount({ ...base, category: 'nature' })).toBe(1);
  });

  it('행사 + 상태는 2', () => {
    expect(activeFilterCount({ ...base, category: 'festival', listEventStatus: 'ONGOING' })).toBe(2);
  });

  it('속성 2개는 2', () => {
    expect(activeFilterCount({ ...base, attributes: new Set(['parking', 'wellness'] as const) })).toBe(2);
  });

  it('반경(geo)·검색어·지역은 세지 않는다', () => {
    expect(activeFilterCount({ ...base, geo: { radiusKm: 5 } })).toBe(0);
    expect(activeFilterCount({ ...base, keyword: '궁궐', sidoCode: '11', sigunguCode: '110', areaCode: '1' })).toBe(0);
    expect(activeFilterCount({ ...base, keyword: '궁궐', category: 'nature', geo: { radiusKm: 5 } })).toBe(1);
  });
});

describe('visitSummary — 방문 요약 칸과 배지 줄', () => {
  const base: Attraction = {
    id: '1', contentId: '126508', lang: 'ko', title: '경복궁', category: 'history', areaCode: null,
    address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
    distanceKm: null, position: 0,
    closureState: 'UNKNOWN', closedWeekdays: null, attrParking: 'UNKNOWN', attrCreditCard: 'UNKNOWN',
    attrStrollerRental: 'UNKNOWN', petPolicy: 'UNKNOWN', attrAdmission: 'UNKNOWN',
  };
  const cell = (a: Partial<Attraction>, label: string, lang: 'ko' | 'en' = 'ko') =>
    visitSummary({ ...base, ...a }, lang).rows.find((r) => r.label === label)?.value;

  it('칸은 표 순서 그대로, 값이 없으면 「정보 없음 / Not provided」로 남는다', () => {
    expect(visitSummary(base, 'ko').rows.map((r) => r.label)).toEqual(
      ['요금', '이용시간', '쉬는 날', '주차', '반려동물', '무장애', '확인 상태'],
    );
    expect(visitSummary(base, 'en').rows.map((r) => r.label)).toEqual(
      ['Admission', 'Hours', 'Closed', 'Parking', 'Pets', 'Accessibility', 'Data status'],
    );
    expect(visitSummary(base, 'ko').rows.slice(0, 6).map((r) => r.value)).toEqual(Array(6).fill('정보 없음'));
    expect(visitSummary(base, 'en').rows.slice(0, 6).map((r) => r.value)).toEqual(Array(6).fill('Not provided'));
  });

  it('요금 — feeText 가 우선이고 다시 정규화하지 않는다, 없으면 useFee 원문', () => {
    expect(cell({ feeText: '<어린이> 무료', useFee: '3,000원' }, '요금')).toBe('<어린이> 무료');
    expect(cell({ feeText: null, useFee: '어른 3,000원<br>어린이 1,500원' }, '요금')).toBe('어른 3,000원\n어린이 1,500원');
    expect(cell({ useFee: '&lt;성인&gt; 1,000원' }, '요금')).toBe('<성인> 1,000원');
    expect(cell({ feeText: null, useFee: ' <br> ' }, '요금')).toBe('정보 없음');
    expect(cell({ feeText: null, useFee: null }, 'Admission', 'en')).toBe('Not provided');
  });

  it('이용시간 — 원문 평문', () => {
    expect(cell({ useTime: '09:00~18:00<br />입장 마감 17:00' }, '이용시간')).toBe('09:00~18:00\n입장 마감 17:00');
  });

  it('쉬는 날 — 해석 줄과 원문 줄 두 줄, 모르면 원문만', () => {
    expect(cell({ closureState: 'WEEKLY', closedWeekdays: ['TUE'], restDate: '매주 화요일' }, '쉬는 날')).toBe('매주 화요일 휴무\n매주 화요일');
    expect(cell({ closureState: 'WEEKLY', closedWeekdays: ['TUE'], restDate: 'Tuesdays' }, 'Closed', 'en')).toBe('Closed on Tuesdays\nTuesdays');
    expect(cell({ closureState: 'ALWAYS_OPEN', restDate: null }, '쉬는 날')).toBe('연중무휴');
    expect(cell({ closureState: 'ALWAYS_OPEN', restDate: null }, 'Closed', 'en')).toBe('Open every day');
    expect(cell({ closureState: 'UNKNOWN', restDate: '설날 당일' }, '쉬는 날')).toBe('설날 당일');
    expect(cell({ closureState: 'UNKNOWN', restDate: null }, '쉬는 날')).toBe('정보 없음');
  });

  it('주차 — YES·NO 해석 줄 + 원문, UNKNOWN 에 원문도 없으면 정보 없음', () => {
    expect(cell({ attrParking: 'NO', parking: '불가' }, '주차')).toBe('주차 불가\n불가');
    expect(cell({ attrParking: 'YES', parking: null }, 'Parking', 'en')).toBe('Parking available');
    expect(cell({ attrParking: 'NO' }, 'Parking', 'en')).toBe('No parking');
    expect(cell({ attrParking: 'UNKNOWN', parking: null }, '주차')).toBe('정보 없음');
    expect(cell({ attrParking: 'UNKNOWN', parking: '문의 요망' }, '주차')).toBe('문의 요망');
  });

  it('반려동물 — 허용이면 배지 문구, 모르면 원문', () => {
    expect(cell({ petPolicy: 'ALLOWED', petAcmpyType: '전구역 동반가능' }, '반려동물')).toBe('반려동물 동반 가능');
    expect(cell({ petPolicy: 'PARTIAL' }, 'Pets', 'en')).toBe('Pets allowed in some areas');
    expect(cell({ petPolicy: 'UNKNOWN', petAcmpyType: '소형견만 &amp; 목줄' }, '반려동물')).toBe('소형견만 & 목줄');
    expect(cell({ petPolicy: 'UNKNOWN', petAcmpyType: null }, '반려동물')).toBe('정보 없음');
  });

  it('무장애 — 긍정 항목을 접근성 절과 같은 순서로 「 · 」, 없으면 정보 없음', () => {
    expect(cell({ barrierFree: ['ELEVATOR', 'WHEELCHAIR'] }, '무장애')).toBe('휠체어 · 엘리베이터');
    expect(cell({ barrierFree: ['RESTROOM'] }, 'Accessibility', 'en')).toBe('Accessible restroom');
    expect(cell({ barrierFree: [] }, '무장애')).toBe('정보 없음');
    expect(cell({ barrierFree: null }, '무장애')).toBe('정보 없음');
  });

  it('속성이 없는 옛 문서는 해석 줄 없이 원문 줄만', () => {
    const legacy: Partial<Attraction> = {
      closureState: undefined, closedWeekdays: undefined, attrParking: undefined, petPolicy: undefined,
      attrCreditCard: undefined, attrStrollerRental: undefined, attrAdmission: undefined,
      restDate: '매주 월요일', parking: '가능', petAcmpyType: '불가',
    };
    expect(cell(legacy, '쉬는 날')).toBe('매주 월요일');
    expect(cell(legacy, '주차')).toBe('가능');
    expect(cell(legacy, '반려동물')).toBe('불가');
    expect(visitSummary({ ...base, ...legacy }, 'ko').badgeLine).toBeNull();
  });

  it('확인 상태 — 출처 표시명 · 원천 갱신일 · 수집일, 모르는 출처는 TourAPI 로 짐작하지 않는다', () => {
    const at = '2026-09-30T10:15:00';
    expect(cell({ source: 'TOURAPI', modifiedAt: at }, '확인 상태'))
      .toBe('출처: 한국관광공사 TourAPI · 원천 갱신일: 2026-09-30 · 수집일: 정보 없음');
    expect(cell({ source: 'TOURAPI', modifiedAt: at }, 'Data status', 'en'))
      .toBe('Source: Korea Tourism Organization TourAPI · Source updated: 2026-09-30 · Collected: Not provided');
    expect(cell({ source: 'GOCAMPING', modifiedAt: at }, '확인 상태'))
      .toBe('출처: 한국관광공사 고캠핑 · 원천 갱신일: 2026-09-30 · 수집일: 정보 없음');
    expect(cell({ source: 'GOCAMPING', modifiedAt: at }, 'Data status', 'en'))
      .toBe('Source: Korea Tourism Organization GoCamping · Source updated: 2026-09-30 · Collected: Not provided');
    expect(cell({ source: null, modifiedAt: null }, '확인 상태'))
      .toBe('출처: 정보 없음 · 원천 갱신일: 정보 없음 · 수집일: 정보 없음');
    expect(cell({ source: 'KTO_OTHER', modifiedAt: null }, 'Data status', 'en'))
      .toBe('Source: Not provided · Source updated: Not provided · Collected: Not provided');
  });

  it('배지 줄 — 신용카드 · 유모차 · 많이 클릭한 곳 순서, UNKNOWN 은 넣지 않고 0개면 없다', () => {
    expect(visitSummary({ ...base, attrCreditCard: 'YES', attrStrollerRental: 'NO', uniqueClickers14d: 9 }, 'ko').badgeLine)
      .toBe('신용카드 가능 · 유모차 대여 없음 · 많이 클릭한 곳');
    expect(visitSummary({ ...base, attrCreditCard: 'NO', uniqueClickers14d: 4 }, 'en').badgeLine).toBe('Credit cards not accepted');
    expect(visitSummary({ ...base, attrStrollerRental: 'YES', uniqueClickers14d: 5 }, 'en').badgeLine)
      .toBe('Stroller rental · Frequently clicked');
    expect(visitSummary(base, 'ko').badgeLine).toBeNull();
  });

  it('배지 줄에는 칸으로 옮긴 휴무·주차·반려동물·입장료가 없다', () => {
    const all = visitSummary({
      ...base, closureState: 'ALWAYS_OPEN', attrParking: 'YES', petPolicy: 'ALLOWED', attrAdmission: 'FREE',
    }, 'ko');
    expect(all.badgeLine).toBeNull();
  });
});

describe('placeSourceLine — 바닥 출처 줄', () => {
  const a = { camping: '{}' } as Attraction;

  it('고캠핑 원천이면 첫 항목이 고캠핑이고 「고캠핑」을 한 번만 낸다', () => {
    const ko = placeSourceLine({ ...a, source: 'GOCAMPING' }, 'ko');
    expect(ko).toBe('출처: 한국관광공사 고캠핑');
    expect(ko.match(/고캠핑/g)).toHaveLength(1);
    expect(placeSourceLine({ ...a, source: 'GOCAMPING' }, 'en')).toBe('Source: Korea Tourism Organization GoCamping');
  });

  it('그 밖(TourAPI·null·모르는 값)은 지금 고정 문구 — 의무 문구라 비우지 않는다', () => {
    expect(placeSourceLine({ ...a, source: 'TOURAPI' }, 'ko')).toBe('출처: 한국관광공사 TourAPI · 고캠핑');
    expect(placeSourceLine({ ...a, source: null }, 'ko')).toBe('출처: 한국관광공사 TourAPI · 고캠핑');
    expect(placeSourceLine(null, 'en')).toBe('Source: Korea Tourism Organization TourAPI');
  });
});
