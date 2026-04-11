import type { World } from '../types'
import { TileType } from '../types'

export function idx(cols: number, col: number, row: number): number {
  return row * cols + col
}

export function getTile(world: World, col: number, row: number): TileType {
  if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return TileType.VOID
  return world.tiles[idx(world.cols, col, row)]
}

export function setTile(
  world: World,
  col: number,
  row: number,
  tile: TileType,
  tint?: string
): void {
  if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return
  const i = idx(world.cols, col, row)
  world.tiles[i] = tile
  if (tint !== undefined) world.tileTint[i] = tint
}

export function fillRect(
  world: World,
  x: number,
  y: number,
  w: number,
  h: number,
  tile: TileType,
  tint?: string
): void {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      setTile(world, col, row, tile, tint)
    }
  }
}

export function isWalkable(world: World, col: number, row: number): boolean {
  const t = getTile(world, col, row)
  return t === TileType.FLOOR || t === TileType.CARPET_A || t === TileType.CARPET_B
    || t === TileType.BREAK || t === TileType.CEO
}

/**
 * Treat desks (and other blocking furniture) as impassable. Seats are walkable
 * because the character needs to enter that tile. Exclude desk tiles from
 * walking path.
 */
export function isWalkableForWalking(world: World, col: number, row: number, blockedSet: Set<number>): boolean {
  if (!isWalkable(world, col, row)) return false
  return !blockedSet.has(idx(world.cols, col, row))
}

export function buildBlockedSet(world: World): Set<number> {
  const blocked = new Set<number>()
  const seatKeys = new Set<number>()
  for (const seat of world.seats) {
    seatKeys.add(idx(world.cols, seat.col, seat.row))
  }
  for (const f of world.furniture) {
    for (let dy = 0; dy < f.h; dy++) {
      for (let dx = 0; dx < f.w; dx++) {
        const c = f.col + dx
        const r = f.row + dy
        const k = idx(world.cols, c, r)
        if (seatKeys.has(k)) continue
        blocked.add(k)
      }
    }
  }
  return blocked
}
