import { describe, expect, it } from 'vitest';
import { caffeineLabel, isCaffeineNone } from '../cafeView';

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
