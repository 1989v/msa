// 악세서리는 직업 전용 · 직업당 셋 (2026-09-13 소감 두 번).
// ① 「직업별로 무관한 악세서리들이 있어보임」 → 악세서리 하나는 직업 하나만 든다. 겹쳐 있으면
//    「이 직업의 무기」라는 인상이 안 서고, KO 드랍도 아무나 주워 가는 통에 무기가 직업의 일부로 안 읽힌다.
// ② 「직업당 세 개 이상으로」 → 전용이 하나뿐이면 고를 것이 없다. 맨손 + 전용 셋으로 맞췄다.
import { describe, it, expect } from 'vitest';
import { STYLES, STYLE_IDS, allowedAccessory, randomLoadout } from '../src/styles.ts';
import { ACCESSORY_IDS, ACCESSORIES } from '../src/accessories.ts';
import { makeRng } from '../src/math.ts';

describe('직업 전용 악세서리', () => {
  it('악세서리마다 들 수 있는 직업이 정확히 하나다', () => {
    for (const acc of ACCESSORY_IDS) {
      if (acc === 'none') continue; // 맨손은 전 직업 공통
      const owners = STYLE_IDS.filter((st) => STYLES[st].accessories.includes(acc));
      expect(owners, `${ACCESSORIES[acc].name} 을 드는 직업`).toHaveLength(1);
    }
  });

  it('직업마다 맨손 + 전용 셋이다', () => {
    for (const st of STYLE_IDS) {
      expect(STYLES[st].accessories[0], `${STYLES[st].name} 첫 칸`).toBe('none');
      expect(STYLES[st].accessories.length, `${STYLES[st].name} 의 악세서리 수`).toBeGreaterThanOrEqual(4);
      expect(new Set(STYLES[st].accessories).size, `${STYLES[st].name} 에 중복`).toBe(STYLES[st].accessories.length);
    }
  });

  it('악세서리는 하나도 남김없이 어느 직업엔가 붙어 있다 — 아무도 못 드는 무기를 만들지 않는다', () => {
    const owned = new Set(STYLE_IDS.flatMap((st) => STYLES[st].accessories));
    for (const acc of ACCESSORY_IDS) expect(owned.has(acc), `${ACCESSORIES[acc].name} 을 드는 직업이 없다`).toBe(true);
  });

  it('남의 전용은 맨손으로 바뀐다', () => {
    for (const st of STYLE_IDS) {
      const mine = new Set(STYLES[st].accessories);
      for (const acc of ACCESSORY_IDS) {
        if (acc === 'none') continue;
        expect(allowedAccessory(st, acc), `${STYLES[st].name} 가 ${ACCESSORIES[acc].name}`).toBe(mine.has(acc) ? acc : 'none');
      }
    }
  });

  it('봇 장비는 전 직업·전 악세서리가 고루 나온다 — 맨손만 잔뜩이면 판이 심심하다', () => {
    const rng = makeRng(1234);
    const styleCount: Record<string, number> = {}, accCount: Record<string, number> = {};
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const { style, acc } = randomLoadout(rng);
      expect(allowedAccessory(style, acc)).toBe(acc); // 봇이 못 드는 조합을 뽑지 않는다
      styleCount[style] = (styleCount[style] ?? 0) + 1;
      accCount[acc] = (accCount[acc] ?? 0) + 1;
    }
    for (const st of STYLE_IDS) expect(styleCount[st] / N).toBeGreaterThan(0.12); // 다섯 직업 = 20% 씩
    expect(accCount.none / N).toBeLessThan(0.45); // 절반이 맨손이면 무기가 안 보인다
    expect(accCount.none / N).toBeGreaterThan(0.2); // 맨손도 실제로 나와야 한다 (맨손 사슬이 죽은 코드가 되면 안 된다)
    // 무기 15종을 다섯 직업이 나눠 가지므로 한 종은 대략 (2/3) / 15 ≈ 4.4% 다. 절반 밑으로 떨어지면 배정이 치우친 것이다.
    for (const acc of ACCESSORY_IDS) {
      if (acc === 'none') continue;
      expect(accCount[acc] / N, `${ACCESSORIES[acc].name} 비율`).toBeGreaterThan(0.022);
    }
  });
});
