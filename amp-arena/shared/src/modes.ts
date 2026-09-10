// 모드 — 기획서 §10.
export type ModeId = 'ffa_survival' | 'ffa_dm' | 'team_dm';

export interface ModeDef {
  id: ModeId;
  name: string;
  teams: boolean;
  lives: number;      // 0 = 무한 (리스폰)
  respawn: boolean;
}

export const MODES: Record<ModeId, ModeDef> = {
  ffa_survival: { id: 'ffa_survival', name: '개인 서바이벌', teams: false, lives: 1, respawn: false },
  ffa_dm: { id: 'ffa_dm', name: '개인 데스매치', teams: false, lives: 0, respawn: true },
  team_dm: { id: 'team_dm', name: '팀 데스매치', teams: true, lives: 0, respawn: true },
};

export const MODE_IDS: ModeId[] = ['ffa_survival', 'ffa_dm', 'team_dm'];
