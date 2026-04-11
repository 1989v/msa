import type { World } from '../types'
import { buildBlockedSet, isWalkableForWalking } from '../layout/tileMap'

export interface PathNode {
  col: number
  row: number
}

/**
 * BFS path from (from) to (to). Returns a list of tiles EXCLUDING the origin,
 * or empty array if unreachable. 4-directional.
 */
export function findPath(world: World, from: PathNode, to: PathNode): PathNode[] {
  if (from.col === to.col && from.row === to.row) return []

  const blocked = buildBlockedSet(world)
  // Allow entering target even if blocked by desk — only seat target tiles
  // should normally be reachable; unblock the exact target if it's the
  // character's own destination.
  blocked.delete(to.row * world.cols + to.col)

  const cols = world.cols
  const queue: number[] = []
  const visited = new Set<number>()
  const prev = new Map<number, number>()

  const start = from.row * cols + from.col
  const goal = to.row * cols + to.col

  queue.push(start)
  visited.add(start)

  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const

  let found = false
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === goal) {
      found = true
      break
    }
    const cCol = cur % cols
    const cRow = Math.floor(cur / cols)
    for (const [dx, dy] of dirs) {
      const nc = cCol + dx
      const nr = cRow + dy
      if (nc < 0 || nr < 0 || nc >= world.cols || nr >= world.rows) continue
      const nk = nr * cols + nc
      if (visited.has(nk)) continue
      if (!isWalkableForWalking(world, nc, nr, blocked)) continue
      visited.add(nk)
      prev.set(nk, cur)
      queue.push(nk)
    }
  }

  if (!found) return []

  const path: PathNode[] = []
  let cur = goal
  while (cur !== start) {
    path.push({ col: cur % cols, row: Math.floor(cur / cols) })
    const p = prev.get(cur)
    if (p === undefined) break
    cur = p
  }
  path.reverse()
  return path
}
