// 엠블럼 인코딩·명단 크기 (2026-09-12 스킨 페인터): 12×12 격자를 144자 문자열로. 8명치를 cfg 에 실어도 릴레이 상한(4KB) 안이어야 한다.
import { describe, it, expect } from 'vitest';
import { sanitizeEmblem, EMBLEM_CELLS, RELAY_MAX_CHARS, ACCESSORY_IDS, STYLE_IDS, type MatchConfig } from '../src/index.ts';

const full = (ch: string) => ch.repeat(EMBLEM_CELLS);

describe('sanitizeEmblem', () => {
  it('144자리 0~9 만 통과, 빈(전부 0) 그림은 undefined', () => {
    expect(EMBLEM_CELLS).toBe(144);
    const g = full('0').slice(0, 143) + '5';
    expect(sanitizeEmblem(g)).toBe(g);
    expect(sanitizeEmblem(full('0'))).toBeUndefined();     // 전부 투명 = 없음
    expect(sanitizeEmblem(full('9'))).toBe(full('9'));
  });
  it('길이·문자·타입이 틀리면 undefined', () => {
    expect(sanitizeEmblem(full('1').slice(0, 143))).toBeUndefined(); // 143자
    expect(sanitizeEmblem(full('1') + '1')).toBeUndefined();          // 145자
    expect(sanitizeEmblem(full('0').slice(0, 143) + 'a')).toBeUndefined();
    expect(sanitizeEmblem(null)).toBeUndefined();
    expect(sanitizeEmblem(123)).toBeUndefined();
  });
});

describe('cfg 크기', () => {
  it('8명 전원이 꽉 찬 엠블럼·스킨·스탯을 가져도 시작 메시지가 릴레이 상한 안', () => {
    // **제일 긴 조합으로 잰다** — 악세서리가 16종이 되면서 id 길이가 제각각이라(none 4자 ~ greatsword 10자),
    // 앞에서부터 8개를 쓰면 최악이 아니다. 이름도 닉네임 상한(10자)까지 채운다.
    const longest = [...ACCESSORY_IDS].sort((a, b) => b.length - a.length);
    const roster = [];
    for (let i = 0; i < 8; i++) roster.push({
      id: i, name: '가'.repeat(10), team: i % 2, acc: longest[i % longest.length], style: STYLE_IDS[i % STYLE_IDS.length], bot: false,
      stats: { hp: 5, atk: 5, def: 5, jmp: 5, spd: 5, tec: 4 }, skin: { shirt: 15, hair: 5, band: 3 }, emblem: full('7'),
    });
    const cfg: MatchConfig = { epoch: 1, host: 0, map: 'colosseum', mode: 'team_dm', seconds: 300, seed: 0x7fffffff, roster };
    const startLen = JSON.stringify({ t: 'move', d: { t: 'start', cfg } }).length;
    expect(startLen, `시작 봉투 ${startLen}자 / 상한 ${RELAY_MAX_CHARS}`).toBeLessThan(RELAY_MAX_CHARS);
    expect(roster.every((r) => sanitizeEmblem(r.emblem) === r.emblem)).toBe(true);
  });
});
