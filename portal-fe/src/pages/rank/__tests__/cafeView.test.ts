import { describe, expect, it } from 'vitest';
import { caffeineLabel, isCaffeineNone, volumeLabel } from '../cafeView';

describe('카페인 상태 구분', () => {
  it('없음 필터에는 공식 0과 디카페인만 들어가며 미공개는 제외한다', () => {
    expect(['DISCLOSED', 'ZERO', 'DECAF', 'UNDISCLOSED'].filter(status => isCaffeineNone(status as Parameters<typeof isCaffeineNone>[0]))).toEqual(['ZERO', 'DECAF']);
    expect(caffeineLabel({ caffeineStatus: 'UNDISCLOSED', caffeineMg: null })).toBe('미공개');
    expect(caffeineLabel({ caffeineStatus: 'ZERO', caffeineMg: 0 })).toBe('0 mg');
    expect(caffeineLabel({ caffeineStatus: 'DECAF', caffeineMg: 10 })).toBe('디카페인 · 10 mg');
  });
  it('공개됐으나 단일 수치를 확정하지 못한 원문은 미공개나 0으로 표시하지 않는다', () => {
    expect(caffeineLabel({ caffeineStatus: 'DISCLOSED', caffeineMg: null })).toBe('수치 미확정');
  });
});

describe('컵 용량 표기', () => {
  it('사이즈와 ml를 함께 보여준다', () => {
    expect(volumeLabel({ sizeLabel: 'R', cupVolumeMl: 414, servingBasis: null })).toBe('R · 414ml');
  });
  it('g은 무게로 남기고 미표시 용량은 구별한다', () => {
    expect(volumeLabel({ sizeLabel: null, cupVolumeMl: null, servingBasis: '1회 제공량(g) 310' })).toBe('310g');
    expect(volumeLabel({ sizeLabel: null, cupVolumeMl: null, servingBasis: '310 g' })).toBe('310g');
    expect(volumeLabel({ sizeLabel: null, cupVolumeMl: null, servingBasis: null })).toBe('용량 미표시');
  });
});

describe('metric display', () => {
  it('rounds only display values, preserving tiny positives', async () => {
    const { formatCafeNumber } = await import('../cafeView');
    expect(formatCafeNumber(0.004)).toBe('<0.1');
    expect(formatCafeNumber(0)).toBe('0');
    expect(formatCafeNumber(15.24)).toBe('15.2');
    expect(formatCafeNumber(10)).toBe('10');
  });
});

it('never leaks nonfinite or missing values through metadata labels', () => {
  expect(volumeLabel({ sizeLabel: null, cupVolumeMl: NaN, servingBasis: null })).toBe('용량 미표시');
  expect(caffeineLabel({ caffeineStatus: 'DISCLOSED', caffeineMg: NaN })).toBe('수치 미확정');
  expect(caffeineLabel({ caffeineStatus: 'DECAF', caffeineMg: undefined as unknown as null })).toBe('디카페인 · 수치 미확정');
});

describe('중량 기준 추정 용량', () => {
  it('g만 공개된 음료는 100ml당 값 앞에 ≈를 붙이고 용량 출처를 밝힌다', async () => {
    const { cafeMetric } = await import('../cafeView');
    const drink = { sugarG: 31, caffeineMg: 156, kcal: 15, sugarPer100ml: 10, caffeinePer100ml: 50.3226, kcalPer100ml: 4.8387, cupVolumeMl: 310, volumeSource: 'WEIGHT_ESTIMATE', caffeineStatus: 'DISCLOSED', servingBasis: '1회 제공량(g) 310', sizeLabel: 'S' } as unknown as Parameters<typeof cafeMetric>[0];
    expect(cafeMetric(drink, 'sugar', '100ml').amount).toBe('≈10');
    expect(cafeMetric(drink, 'caffeine', '100ml').amount).toBe('≈50.3');
    expect(cafeMetric(drink, 'sugar', 'serving').amount).toBe('31');
    expect(cafeMetric({ ...drink, volumeSource: 'ROW' }, 'sugar', '100ml').amount).toBe('10');
    expect(volumeLabel(drink)).toBe('S · 310g(≈310ml 추정)');
  });
});
