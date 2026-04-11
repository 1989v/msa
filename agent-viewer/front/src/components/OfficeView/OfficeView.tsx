import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import {
  TILE_SIZE,
  RENDER_SCALE,
  buildDefaultLayout,
  drawWorld,
  pickCharacter,
  startGameLoop,
  syncWorldWithStore,
  type World,
} from '@/office'
import { buildSnapshot } from '@/office/engine/mapAgentState'
import { preloadSheets } from '@/office/assets/loader'
import styles from './OfficeView.module.css'

export function OfficeView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const overlayRef = useRef<{ hoveredAgentId: string | null; selectedAgentId: string | null }>({
    hoveredAgentId: null,
    selectedAgentId: null,
  })

  const agents = useAppStore((s) => s.agents)
  const teams = useAppStore((s) => s.teams)
  const sessions = useAppStore((s) => s.sessions)
  const liveSessions = useAppStore((s) => s.liveSessions)
  const liveSubagents = useAppStore((s) => s.liveSubagents)
  const notifications = useAppStore((s) => s.notifications)
  const selectedAgentId = useAppStore((s) => s.selectedAgentId)
  const selectAgent = useAppStore((s) => s.selectAgent)

  const [hoverInfo, setHoverInfo] = useState<{ name: string; role: string; team: string } | null>(
    null,
  )

  const canvasSize = useMemo(() => {
    const cols = 40
    const rows = 26
    return {
      logicalW: cols * TILE_SIZE,
      logicalH: rows * TILE_SIZE,
    }
  }, [])

  // Build world once and start game loop
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Kick off asset preload (non-blocking — renderer falls back to procedural)
    void preloadSheets()

    const world = buildDefaultLayout(teams, agents)
    worldRef.current = world
    syncWorldWithStore(
      world,
      buildSnapshot({
        agents,
        teams,
        sessions,
        liveSessions: [...liveSessions.values()],
        liveSubagents: [...liveSubagents.values()],
        notifications,
      }),
    )

    const render = (w: World) => {
      drawWorld(ctx, w, overlayRef.current)
    }

    const stop = startGameLoop(world, render)
    return () => {
      stop()
      worldRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Store → world sync
  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    syncWorldWithStore(
      world,
      buildSnapshot({
        agents,
        teams,
        sessions,
        liveSessions: [...liveSessions.values()],
        liveSubagents: [...liveSubagents.values()],
        notifications,
      }),
    )
  }, [agents, teams, sessions, liveSessions, liveSubagents, notifications])

  // Selected outline sync
  useEffect(() => {
    overlayRef.current = {
      ...overlayRef.current,
      selectedAgentId,
    }
  }, [selectedAgentId])

  function clientToLogical(clientX: number, clientY: number): { px: number; py: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (clientX - rect.left) * scaleX
    const py = (clientY - rect.top) * scaleY
    return { px, py }
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const world = worldRef.current
    if (!world) return
    const pt = clientToLogical(e.clientX, e.clientY)
    if (!pt) return
    const hit = pickCharacter(world, pt.px, pt.py)
    if (hit) {
      selectAgent(hit.agentId)
    } else {
      selectAgent(null)
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const world = worldRef.current
    if (!world) return
    const pt = clientToLogical(e.clientX, e.clientY)
    if (!pt) return
    const hit = pickCharacter(world, pt.px, pt.py)
    overlayRef.current = {
      ...overlayRef.current,
      hoveredAgentId: hit?.agentId ?? null,
    }
    if (hit) {
      const team = teams.find((t) => t.id === hit.teamId)?.name ?? hit.teamId
      setHoverInfo({ name: hit.name, role: hit.role, team })
    } else if (hoverInfo) {
      setHoverInfo(null)
    }
  }

  function onMouseLeave() {
    overlayRef.current = { ...overlayRef.current, hoveredAgentId: null }
    setHoverInfo(null)
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.stage}
        style={{
          width: canvasSize.logicalW * RENDER_SCALE,
          maxWidth: '100%',
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.logicalW}
          height={canvasSize.logicalH}
          className={styles.canvas}
          onClick={onClick}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: '#3fb950' }} /> working
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: '#d29922' }} /> waiting
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: '#a78bfa' }} /> approval
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: '#8b949e' }} /> resting
          </div>
        </div>
        {hoverInfo && (
          <div className={styles.hoverInfo}>
            <span className={styles.hoverName}>{hoverInfo.name}</span>
            <span className={styles.hoverRole}>{hoverInfo.role}</span>
            <span className={styles.hoverRole}>{hoverInfo.team}</span>
          </div>
        )}
      </div>
    </div>
  )
}
