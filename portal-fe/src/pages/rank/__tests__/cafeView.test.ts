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
