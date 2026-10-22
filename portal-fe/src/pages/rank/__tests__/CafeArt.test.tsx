import { describe, expect, it } from 'vitest';
import { cafeCupTone } from '../CafeArt';
describe('local cafe cup palette', () => {
  it.each([['아메리카노', '커피', 'coffee'], ['카페라떼', '라떼', 'cream'], ['레몬에이드', '에이드', 'yellow'], ['청포도', '에이드', 'yellow'], ['요거트', '스무디·프라페', 'fruit'], ['딸기라떼', '라떼', 'fruit'], ['망고스무디', '스무디·프라페', 'yellow'], ['말차라떼', '라떼', 'tea']])('%s uses %s group tone %s', (name, group, tone) => expect(cafeCupTone(name, group)).toBe(tone));
});
