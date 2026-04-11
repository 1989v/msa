export const TILE_SIZE = 16
export const RENDER_SCALE = 2

export const WORLD_COLS = 40
export const WORLD_ROWS = 26

export const CEO_ROWS = 4
export const BREAK_ROWS = 4

export const COLORS = {
  background: '#0b0f14',
  floor: '#1a2130',
  floorAlt: '#1e2538',
  wall: '#2d333b',
  wallTop: '#3a4150',
  carpetA: '#1f2a3d',
  carpetB: '#232f43',
  breakFloor: '#1b2e26',
  breakFloorAlt: '#1f3329',
  ceoFloor: '#2a1f36',
  ceoFloorAlt: '#321f3c',
  gridLine: 'rgba(255,255,255,0.04)',
  hover: '#ffcc33',
  selected: '#58a6ff',
  bubbleBg: '#ffffff',
  bubbleBorder: '#1f2933',
  bubbleText: '#1a1a2e',
} as const

export const TIMINGS = {
  idleFrame: 0.6,       // seconds per idle bob frame
  typeFrame: 0.15,      // seconds per typing frame
  walkFrame: 0.18,      // seconds per walk step
  walkSpeed: 3.2,       // tiles per second
  wanderMinDelay: 6,    // min seconds idle-at-seat before wandering
  wanderMaxDelay: 16,   // max seconds
  wanderDwellMin: 2,
  wanderDwellMax: 5,
  wanderChance: 0.45,   // probability at each wander check
  spawnDuration: 0.8,   // sub-agent spawn effect
} as const
