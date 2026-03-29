// Pixel art sprite configurations using CSS box-shadow pixel art
// Each sprite is a 16x16 grid scaled up for display

export interface SpriteFrame {
  pixels: string // CSS box-shadow pixel data
  width: number
  height: number
}

export interface SpriteConfig {
  name: string
  color: string
  accentColor: string
  skinColor: string
}

export const SPRITE_CONFIGS: Record<string, SpriteConfig> = {
  warrior: { name: 'Warrior', color: '#58a6ff', accentColor: '#1f6feb', skinColor: '#ffd4a3' },
  mage: { name: 'Mage', color: '#bc8cff', accentColor: '#8957e5', skinColor: '#ffd4a3' },
  archer: { name: 'Archer', color: '#3fb950', accentColor: '#238636', skinColor: '#ffd4a3' },
  healer: { name: 'Healer', color: '#f85149', accentColor: '#da3633', skinColor: '#ffd4a3' },
  scholar: { name: 'Scholar', color: '#d29922', accentColor: '#9e6a03', skinColor: '#ffd4a3' },
  sentinel: { name: 'Sentinel', color: '#8b949e', accentColor: '#6e7681', skinColor: '#ffd4a3' },
  architect: { name: 'Architect', color: '#7ee787', accentColor: '#3fb950', skinColor: '#ffd4a3' },
  strategist: { name: 'Strategist', color: '#a5d6ff', accentColor: '#58a6ff', skinColor: '#ffd4a3' },
  rogue: { name: 'Rogue', color: '#f0883e', accentColor: '#d18616', skinColor: '#ffd4a3' },
  merchant: { name: 'Merchant', color: '#0052cc', accentColor: '#003d99', skinColor: '#ffd4a3' },
}

export function getSpriteConfig(type: string): SpriteConfig {
  return SPRITE_CONFIGS[type] ?? SPRITE_CONFIGS.warrior
}
