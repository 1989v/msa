import { describe, expect, it } from 'vitest';
import { applicationErrors, managePath, referenceStores, stewardError, stewardScreen, storeInput, validManual } from '../stewardState';
import { marketSourceBadges } from '../marketView';
import type { MarketStore } from '../../../api/marketApi';

describe('steward application and restricted editing', () => {
  it('maps absent and rejected to form, pending to waiting, suspended to contact, active to manage', () => {
    expect([null, 'REJECTED', 'PENDING', 'SUSPENDED', 'ACTIVE'].map(status => stewardScreen(status as Parameters<typeof stewardScreen>[0]))).toEqual(['apply', 'apply', 'pending', 'suspended', 'manage']);
  });
  it('validates trimmed required input and API length limits', () => {
    expect(applicationErrors(' ', ' ')).toEqual({ orgName: '단체명을 입력하세요.', contact: '연락처를 입력하세요.' });
    expect(applicationErrors('단체', '010-1234')).toEqual({ orgName: '', contact: '' });
    expect(applicationErrors('a'.repeat(301), 'a'.repeat(501))).toEqual({ orgName: '단체명은 300자 이내로 입력하세요.', contact: '연락처는 500자 이내로 입력하세요.' });
  });
  it('requires reference store, relative position and memo for new manual stores', () => {
    const form = { ...storeInput(), name: '새 가게' };
    expect(validManual(form)).toBe(false);
    expect(validManual({ ...form, referenceStoreId: 2, positionNote: '입구 오른쪽' })).toBe(true);
    expect(validManual({ ...form, referenceStoreId: 2, positionNote: ' ', relativePosition: '' })).toBe(false);
    expect(referenceStores([])).toEqual([]);
  });
  it('uses market DB IDs, localized routes and friendly forbidden errors', () => {
    expect(managePath(7, 'ko')).toBe('/markets/7/manage'); expect(managePath(7, 'en')).toBe('/en/markets/7/manage');
    expect(stewardError({ isAxiosError: true, response: { status: 403 } })).toBe('이 시장 관리 권한이 없습니다.');
  });
  it('adds steward badge for overrides of source stores as well as manual input', () => {
    const store = { sources: ['ONNURI'], manual: false, actorKind: 'STEWARD', pinKind: 'EXACT' } as MarketStore;
    expect(marketSourceBadges(store, 'ko')).toEqual(['가맹점', '상인회 제공']);
    expect(marketSourceBadges({ ...store, manual: true, sources: ['MANUAL'] }, 'ko')).toEqual(['상인회 제공']);
    expect(marketSourceBadges(store, 'en')).toContain('Merchant association');
  });
});
