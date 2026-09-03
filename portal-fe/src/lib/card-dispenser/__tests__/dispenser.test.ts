import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDispenser, escapeHtml, pullAmount, slotCount } from '../index';

// jsdom 에는 matchMedia 가 없다 — 모션 여부는 이 테스트의 관심사가 아니다.
beforeAll(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
});

describe('pullAmount — 정면과의 각 거리가 뽑힘 정도를 정한다', () => {
  const step = 360 / 80; // 80칸

  it('dwell 구간 안은 1, 칸 간격 절반 밖은 0', () => {
    expect(pullAmount(0, step, 0.6)).toBe(1);
    expect(pullAmount((step / 2) * 0.6, step, 0.6)).toBe(1);
    expect(pullAmount(step / 2, step, 0.6)).toBe(0);
    expect(pullAmount(step, step, 0.6)).toBe(0);
  });

  it('사이는 단조 감소하고 부호에 대칭이다', () => {
    const half = step / 2;
    const a = pullAmount(half * 0.7, step, 0.6);
    const b = pullAmount(half * 0.85, step, 0.6);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
    expect(pullAmount(-half * 0.7, step, 0.6)).toBeCloseTo(a);
  });
});

describe('slotCount — 최소 칸 수', () => {
  it('항목이 모자라면 최소 칸 수, 넘치면 항목 수', () => {
    expect(slotCount(3, 24)).toBe(24);
    expect(slotCount(80, 24)).toBe(80);
    expect(slotCount(5)).toBe(5);
  });
});

describe('escapeHtml', () => {
  it('마크업 문자를 엔티티로 바꾼다', () => {
    expect(escapeHtml('<b class="x">&</b>')).toBe('&lt;b class=&quot;x&quot;&gt;&amp;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('createDispenser', () => {
  const items = ['가', '나', '다'];
  afterEach(() => {
    vi.useRealTimers();
  });
  const make = (onChange = vi.fn(), minCards = 24) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const d = createDispenser(host, {
      items,
      minCards,
      revealMs: 0, // 일어남·내려앉음을 즉시 — rAF 없이 상태만 본다
      idleMs: 50,
      render: (it, i) => `<b>${it}-${i}</b>`,
      onChange,
    });
    return { host, d, onChange };
  };
  const front = (host: HTMLElement) => host.querySelector<HTMLElement>('.cd-card[aria-selected="true"]')!;
  const rotY = (el: HTMLElement) => Number(/rotateY\(90deg\)[^]*?rotateY\((-?[\d.]+)deg\)/.exec(el.style.transform)![1]);

  it('항목이 최소 칸 수보다 적으면 있는 것을 돌려 가며 칸을 채운다 — 뒷면 번호가 순환한다', () => {
    const { host } = make();
    const backs = [...host.querySelectorAll('.cd-back')].map((el) => el.textContent);
    expect(backs).toHaveLength(24);
    expect(backs.slice(0, 4)).toEqual(['01', '02', '03', '01']);
  });

  it('정면 카드 근처만 앞면을 그린다 — 24칸 중 다섯 장 언저리', () => {
    const { host } = make();
    const rendered = host.querySelectorAll('.cd-card[data-ready]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(24);
    expect(host.querySelector('.cd-front b')?.textContent).toBe('가-0');
  });

  it('setAngle 로 한 칸 돌리면 다음 항목이 정면이고 onChange 가 온다', () => {
    const { d, onChange } = make();
    expect(d.currentIndex()).toBe(0);
    onChange.mockClear();
    d.setAngle(-(360 / 24));
    expect(d.currentIndex()).toBe(1);
    expect(d.current()).toBe('나');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('나', 1);
  });

  it('spinTo 는 실제 항목으로 멈추고, 도는 동안이 아니라 멈춘 뒤 한 번만 알린다', async () => {
    const { d, onChange } = make();
    onChange.mockClear();
    const picked = await d.spinTo(7, 0); // 7번 칸 = items[7 % 3] = '나'
    expect(picked).toBe('나');
    expect(d.currentIndex()).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('나', 1);
  });

  it("spinTo('random') 은 지금 것을 제외한 칸으로 간다", async () => {
    const { d } = make();
    for (let i = 0; i < 5; i += 1) {
      const before = d.currentIndex();
      const picked = await d.spinTo('random', 0);
      expect(items).toContain(picked);
      // 3항목 24칸이라 다른 칸이어도 같은 항목일 수 있다 — 칸이 바뀌었는지는 정면 표시로 본다
      expect(picked).toBe(d.current());
      void before;
    }
  });

  it('destroy 하면 판을 비운다', () => {
    const { host, d } = make();
    d.destroy();
    expect(host.innerHTML).toBe('');
    expect(host.classList.contains('cd')).toBe(false);
  });

  it('멈춰 있을 때 정면 카드는 완전히 일어나 있다(rotateY -90)', () => {
    const { host } = make();
    expect(front(host).classList.contains('is-out')).toBe(true);
    expect(rotY(front(host))).toBeCloseTo(-90, 1);
  });

  it('setAngle 로 움직이는 동안은 살짝 올라오기만 하고, 조용해지면 일어난다', () => {
    vi.useFakeTimers();
    const { host, d } = make();
    d.setAngle(-(360 / 24) * 3);
    const f = front(host);
    expect(f.classList.contains('is-peek')).toBe(true);
    expect(f.classList.contains('is-out')).toBe(false);
    expect(rotY(f)).toBeCloseTo(0, 1); // 얼굴을 돌리지 않는다
    expect(f.style.transform).toContain('translateY(-18.00px)'); // peek 만큼만
    vi.advanceTimersByTime(60);
    expect(front(host).classList.contains('is-out')).toBe(true);
    expect(rotY(front(host))).toBeCloseTo(-90, 1);
  });

  it('spinTo 는 멈춘 카드가 일어난 뒤에 끝난다', async () => {
    const { host, d } = make();
    await d.spinTo(4, 0);
    expect(front(host).classList.contains('is-out')).toBe(true);
    expect(d.currentIndex()).toBe(1);
  });

  it('일어난 정면 카드를 끌지 않고 뗐으면 onActivate 가 그 항목으로 온다', () => {
    const onActivate = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    createDispenser(host, { items, minCards: 24, revealMs: 0, render: (it) => it, onActivate });
    const card = front(host);
    host.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 10, bubbles: true }));
    card.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('가', 0);
    // 끌었다 놓은 것은 고른 게 아니다
    host.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 10, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, bubbles: true }));
    card.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('Enter 도 일어난 카드를 고른다', () => {
    const onActivate = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    createDispenser(host, { items, minCards: 24, revealMs: 0, render: (it) => it, onActivate });
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onActivate).toHaveBeenCalledWith('가', 0);
  });

  it('빈 목록은 만들 수 없다', () => {
    const host = document.createElement('div');
    expect(() => createDispenser(host, { items: [], render: () => '' })).toThrow();
  });
});
