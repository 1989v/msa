import type { World } from '../types'
import { tickCharacter } from './characters'

export type RenderFn = (world: World) => void

export function startGameLoop(world: World, render: RenderFn): () => void {
  let last = performance.now()
  let rafId = 0

  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    world.time += dt

    const queueTaken = new Set<string>()
    const loungeClaimed = new Set<string>()
    for (const c of world.characters.values()) {
      tickCharacter(c, dt, world, queueTaken, loungeClaimed)
    }

    render(world)
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(rafId)
  }
}
