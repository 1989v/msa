// 시뮬레이션 상수 — 기획서(docs/GDD.md) §5·§6·§10 의 숫자가 여기 한 곳에 있다.
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY = 6; // 10Hz — 릴레이 상한(40 msg/s) 안에서 게스트 입력 20Hz 와 같이 쓴다

export const GRAVITY = 18;
export const MAX_FALL_SPEED = 30;
export const WALK_SPEED = 4.0;   // 2026-09-11 2차 소감: 달리기가 너무 빨라 걷기·달리기 모두 낮춤
export const RUN_SPEED = 6.2;
export const JUMP_SPEED_BASE = 6.5; // + 0.5 × 점프 스탯
export const AIR_CONTROL = 0.35;
export const GROUND_FRICTION = 0.62; // 입력 없을 때 틱마다 곱한다 (약 8틱이면 정지)
export const ICE_ACCEL = 0.07;        // 얼음: 틱당 목표 속도에 붙는 비율
export const ICE_FRICTION = 0.985;    // 얼음: 입력 없을 때 틱당 감속 (약 2.5초 미끄러짐)
export const PLAYER_RADIUS = 0.4;
export const PLAYER_HEIGHT = 1.6;
export const STEP_UP = 0.35; // 이만큼 낮은 턱은 걸어 오른다
export const FALL_Y = -8;
export const MAX_PLAYERS = 8;

export const GUARD_MAX = 100;
export const GUARD_REGEN_PER_TICK = 20 / TICK_RATE;
export const GUARD_COST_MULT = 4;
export const GUARD_ANGLE_DEG = 180;
export const STUN_TICKS = 90;

export const LAND_TICKS = 6;
export const DOWN_TICKS = 50;
export const GETUP_TICKS = 24;
export const ROLL_TICKS = 30;
export const ROLL_SPEED = 6; // 30틱 × 6 m/s ÷ 60 = 3m
export const DEAD_TICKS = 60;
export const RESPAWN_WAIT_TICKS = 180;
export const RESPAWN_INVULN_TICKS = 120;

export const GRAB_RANGE = 1.0;
export const GRAB_CONE_COS = Math.cos((30 * Math.PI) / 180); // 정면 60°
export const GRAB_HOLD_OFFSET = 0.8;
export const HELD_MAX_TICKS = 120;
export const MASH_TO_ESCAPE = 6;
export const THROW_RELEASE_TICK = 10;
export const THROW_RECOVERY = 20;
export const THROW_DAMAGE = 15;
export const THROW_WALL_BONUS = 5;
export const THROW_VEL_H = 7;
export const THROW_VEL_V = 4;

export const CONSEC_HIT_KNOCKBACK_FROM = 4; // 같은 공격자 연속 4히트째부터 넉백 ×1.5
export const KO_CREDIT_TICKS = 180; // 낙사 시 마지막 3초 타격자

export const COUNTDOWN_TICKS = 180;
export const RESULT_TICKS = 600;
export const MATCH_SECONDS_DEFAULT = 180;

export const HIT_HEIGHT = 0.9; // 판정 구 중심 높이
export const BODY_HEIGHT = 0.8; // 피격 구 중심 높이
export const BODY_RADIUS = 0.45;

// 스탯 (1~5, 기본 3)
export const STAT_DEFAULT = 3;
export const hpFromStat = (s: number) => 70 + 10 * s;
export const atkMult = (s: number) => 0.85 + 0.05 * s;
export const defMult = (s: number) => 1.15 - 0.05 * s;
export const jumpSpeed = (s: number) => JUMP_SPEED_BASE + 0.5 * s;
export const speedMult = (s: number) => 0.85 + 0.05 * s;
export const cooldownMult = (s: number) => 1.15 - 0.05 * s;
