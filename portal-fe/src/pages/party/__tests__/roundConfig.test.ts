import { describe, expect, it } from 'vitest';
import {
  canStart,
  fromGroup,
  players,
  setMode,
  setPick,
  setWeight,
  toHandoff,
  toggle,
} from '../roundConfig';

const GROUP = ['민수', '영희', '철수', '지훈'];

describe('T27 판 구성 — 제외가 그룹을 바꾸지 않는다', () => {
  it('그룹에서 열면 전원이 체크돼 있다', () => {
    const c = fromGroup(GROUP);
    expect(c.entries.every((e) => e.included)).toBe(true);
    expect(players(c)).toHaveLength(4);
  });

  it('**토글이 원본 배열을 건드리지 않는다** — 그룹을 들고 있는 쪽이 같은 배열을 가리켜도 안전하다', () => {
    const c = fromGroup(GROUP);
    const before = c.entries;
    const after = toggle(c, 1);

    expect(after).not.toBe(c);
    expect(after.entries).not.toBe(before);
    // 원본은 그대로 — 이것이 「제외는 이번 판에만」의 자료구조 쪽 보장이다
    expect(before[1].included).toBe(true);
    expect(after.entries[1].included).toBe(false);
  });

  it('제외해도 그룹의 별칭 목록은 온전하다', () => {
    const c = toggle(toggle(fromGroup(GROUP), 0), 3);
    expect(c.entries.map((e) => e.alias)).toEqual(GROUP);
    expect(players(c).map((e) => e.alias)).toEqual(['영희', '철수']);
  });

  it('비율 조정도 원본을 안 건드린다', () => {
    const c = fromGroup(GROUP);
    const after = setWeight(c, 0, 3);
    expect(c.entries[0].weight).toBe(1);
    expect(after.entries[0].weight).toBe(3);
  });
});

describe('SR-3 판 설정', () => {
  it('비율은 상한을 넘지 않는다', () => {
    expect(setWeight(fromGroup(GROUP), 0, 99).entries[0].weight).toBe(9);
    expect(setWeight(fromGroup(GROUP), 0, 0).entries[0].weight).toBe(1);
    expect(setWeight(fromGroup(GROUP), 0, -5).entries[0].weight).toBe(1);
  });

  it('걸리는 인원은 참가자 수보다 작다 — 전원이 걸리면 정하는 것이 없다', () => {
    const c = setPick(fromGroup(GROUP), 99);
    expect(c.pick).toBe(3);
  });

  it('제외해서 인원이 줄면 걸리는 인원도 함께 줄어든다', () => {
    let c = setPick(fromGroup(GROUP), 3);
    c = toggle(c, 0);
    c = toggle(c, 1);
    expect(setPick(c, 3).pick).toBe(1);
  });

  it('T45 order 에서는 걸리는 인원 수를 못 바꾼다 — 뜻이 없는 조합을 화면이 만들지 않는다', () => {
    const c = setPick(setMode(setPick(fromGroup(GROUP), 3), 'order'), 3);
    expect(c.mode).toBe('order');
    expect(c.pick).toBe(1);
  });

  it('둘 미만이면 시작할 수 없다', () => {
    let c = fromGroup(GROUP);
    expect(canStart(c)).toBe(true);
    c = toggle(toggle(toggle(c, 0), 1), 2);
    expect(players(c)).toHaveLength(1);
    expect(canStart(c)).toBe(false);
  });
});

describe('SR-8 명부 규약으로 넘기는 모양', () => {
  it('제외된 사람은 안 넘어간다', () => {
    const h = toHandoff(toggle(fromGroup(GROUP), 2));
    expect(h.names).toEqual(['민수', '영희', '지훈']);
    expect(h.weights).toHaveLength(3);
  });

  it('비율이 사람 순서대로 실린다', () => {
    const c = setWeight(setWeight(fromGroup(GROUP), 0, 3), 2, 5);
    expect(toHandoff(c).weights).toEqual([3, 1, 5, 1]);
  });

  it('제외 뒤에도 이름과 비율의 길이가 맞는다 — 어긋나면 엉뚱한 사람의 확률이 오른다', () => {
    const c = setWeight(toggle(setWeight(fromGroup(GROUP), 3, 4), 0), 1, 2);
    const h = toHandoff(c);
    expect(h.names).toHaveLength(h.weights.length);
    expect(h.names).toEqual(['영희', '철수', '지훈']);
    expect(h.weights).toEqual([2, 1, 4]);
  });

  it('방 코드를 함께 넘긴다 — 관전 참가에 쓴다', () => {
    expect(toHandoff(fromGroup(GROUP), 'ABC123').room).toBe('ABC123');
  });

  it('걸리는 인원이 참가자 수를 못 넘는다 — 화면이 먼저 막는다', () => {
    const c = { ...setPick(fromGroup(GROUP), 3), entries: fromGroup(['민수', '영희']).entries };
    expect(toHandoff(c).pick).toBe(1);
  });
});
