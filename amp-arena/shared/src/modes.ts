// 모드 — 기획서 §10.
export type ModeId = 'ffa_survival' | 'ffa_dm' | 'team_dm' | 'coop';

export interface ModeDef {
  id: ModeId;
  name: string;
  teams: boolean;
  lives: number;      // 0 = 무한 (리스폰)
  respawn: boolean;
  /**
   * 협동 시나리오 (2026-09-13 소감 「친구와 한편으로 즐기는 봇 상대 시나리오」).
   * 사람은 전부 레드, 봇은 전부 블루. 봇을 다 눕히면 다음 물결이 더 세게 온다.
   * 이 물결 수를 다 막으면 사람 승, 사람이 목숨을 다 쓰면 봇 승.
   */
  waves?: number;
}

export const MODES: Record<ModeId, ModeDef> = {
  ffa_survival: { id: 'ffa_survival', name: '개인 서바이벌', teams: false, lives: 1, respawn: false },
  ffa_dm: { id: 'ffa_dm', name: '개인 데스매치', teams: false, lives: 0, respawn: true },
  team_dm: { id: 'team_dm', name: '팀 데스매치', teams: true, lives: 0, respawn: true },
  coop: { id: 'coop', name: '협동 · 봇 웨이브', teams: true, lives: 3, respawn: true, waves: 5 },
};

export const MODE_IDS: ModeId[] = ['ffa_survival', 'ffa_dm', 'team_dm', 'coop'];
