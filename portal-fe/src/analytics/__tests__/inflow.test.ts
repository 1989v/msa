import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { landingTypeOf, langOf, referrerHostOf, utmOf } from '../inflow';

/** 레포 루트 — 경로 표 픽스처는 파이썬 봇 집계와 함께 쓰므로 portal-fe 밖에 있다. */
const REPO = resolve(__dirname, '../../../..');

describe('referrerHostOf — 이전 사이트는 호스트만 남긴다', () => {
  const HERE = 'place.1989v.com';
  const cases: [string, string, string][] = [
    ['리퍼러 없음', '', ''],
    ['파싱 실패', 'not a url', ''],
    ['javascript: 스킴', 'javascript:alert(1)', ''],
    ['file: 스킴', 'file:///etc/passwd', ''],
    ['같은 호스트는 self', 'https://place.1989v.com/attractions/12', 'self'],
    ['같은 호스트 대문자도 self', 'https://PLACE.1989v.com/', 'self'],
    ['다른 1989v 서브도메인은 그대로', 'https://blog.1989v.com/posts/x', 'blog.1989v.com'],
    ['apex 도 그대로', 'https://1989v.com/place', '1989v.com'],
    ['경로·쿼리·프래그먼트 제거', 'https://www.google.com/search?q=비밀&token=x#frag', 'www.google.com'],
    ['포트·사용자 정보 제거', 'https://user:pw@cafe.naver.com:8443/a?b=c', 'cafe.naver.com'],
    ['대문자는 소문자로', 'https://WWW.Bing.COM/search', 'www.bing.com'],
    ['http 도 받는다', 'http://search.daum.net/search?q=x', 'search.daum.net'],
    ['안드로이드 앱 리퍼러는 패키지명', 'android-app://com.google.android.googlequicksearchbox/', 'com.google.android.googlequicksearchbox'],
  ];
  it.each(cases)('%s', (_, referrer, expected) => {
    expect(referrerHostOf(referrer, HERE)).toBe(expected);
  });

  it('253자는 남기고 254자는 빈 값', () => {
    // 63자 라벨 넷 = 255자. 끝 라벨을 줄여 길이를 맞춘다.
    const label = 'a'.repeat(63);
    const host253 = `${label}.${label}.${label}.${'b'.repeat(61)}`;
    const host254 = `${label}.${label}.${label}.${'b'.repeat(62)}`;
    expect(host253.length).toBe(253);
    expect(host254.length).toBe(254);
    expect(referrerHostOf(`https://${host253}/`, HERE)).toBe(host253);
    expect(referrerHostOf(`https://${host254}/`, HERE)).toBe('');
  });
});

describe('utmOf — UTM 3종만, 값은 안전한 낱말일 때만', () => {
  it('정상 값은 그대로', () => {
    expect(utmOf('?utm_source=naver_cafe&utm_medium=community&utm_campaign=i2-4.launch~v1')).toEqual({
      utmSource: 'naver_cafe',
      utmMedium: 'community',
      utmCampaign: 'i2-4.launch~v1',
    });
  });

  it('앞뒤 공백은 지운다', () => {
    expect(utmOf('?utm_source=%20google%20')).toEqual({ utmSource: 'google' });
  });

  it('64자는 그대로, 65자는 invalid', () => {
    expect(utmOf(`?utm_campaign=${'c'.repeat(64)}`)).toEqual({ utmCampaign: 'c'.repeat(64) });
    expect(utmOf(`?utm_campaign=${'c'.repeat(65)}`)).toEqual({ utmCampaign: 'invalid' });
  });

  it('이메일·한글·중간 공백은 invalid', () => {
    expect(utmOf('?utm_source=a%40b.com&utm_medium=%ED%95%9C%EA%B8%80&utm_campaign=a%20b')).toEqual({
      utmSource: 'invalid',
      utmMedium: 'invalid',
      utmCampaign: 'invalid',
    });
  });

  it('공백만·빈 값·없는 키는 payload 에서 뺀다', () => {
    expect(utmOf('?utm_source=%20%20&utm_medium=')).toEqual({});
    expect(utmOf('')).toEqual({});
  });

  it('다른 쿼리 키는 읽지 않는다', () => {
    expect(utmOf('?q=비밀&token=abc&utm_term=x&utm_content=y&utm_source=google')).toEqual({ utmSource: 'google' });
  });
});

describe('landingTypeOf — 착지 경로 유형', () => {
  const cases: [string, string][] = [
    ['/', 'hub'],
    ['/en', 'hub'],
    ['/place', 'hub'],
    ['/en/place', 'hub'],
    ['/attractions/4321', 'detail'],
    ['/place/attractions/4321', 'detail'],
    ['/en/attractions/4321', 'detail'],
    ['/attractions/12/', 'detail'],
    ['/regions/11', 'region'],
    ['/place/regions/11', 'region'],
    ['/regions/11/pet', 'attr_landing'],
    ['/en/regions/11/pet', 'attr_landing'],
    ['/guides', 'editorial'],
    ['/guides/jeju-winter', 'editorial'],
    ['/favorites', 'other'],
    ['/shared/abc123', 'other'],
    ['/Attractions/12', 'other'],
  ];
  it.each(cases)('%s → %s', (path, expected) => {
    expect(landingTypeOf(path)).toBe(expected);
  });

  it('공용 픽스처의 landing 값과 일치한다 (파이썬 봇 집계와 같은 표)', () => {
    const rows = JSON.parse(
      readFileSync(resolve(REPO, 'place/ingest/tests/fixtures/path_types.json'), 'utf-8'),
    ) as { path: string; landing: string; crawl: string }[];
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect({ path: row.path, landing: landingTypeOf(row.path) }).toEqual({ path: row.path, landing: row.landing });
    }
  });
});

describe('langOf', () => {
  it.each([
    ['/en', 'en'],
    ['/en/', 'en'],
    ['/en/attractions/1', 'en'],
    ['/english', 'ko'],
    ['/', 'ko'],
    ['/attractions/1', 'ko'],
  ])('%s → %s', (path, expected) => {
    expect(langOf(path)).toBe(expected);
  });
});
