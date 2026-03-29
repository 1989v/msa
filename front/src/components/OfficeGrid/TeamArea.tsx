import { useState } from 'react'
import type { Team, Agent } from '@/types'
import { AgentNode } from './AgentNode'
import styles from './TeamArea.module.css'

interface Props {
  team: Team
  agents: Agent[]
}

export function TeamArea({ team, agents }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`${styles.area} ${hovered ? styles.hovered : ''}`}
      style={{
        borderColor: hovered ? team.color : 'var(--border)',
        gridColumn: `${team.areaPosition.x + 1} / span ${team.areaPosition.w}`,
        gridRow: `${team.areaPosition.y + 1} / span ${team.areaPosition.h}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.header}>
        <span className={styles.colorDot} style={{ backgroundColor: team.color }} />
        <span className={styles.teamName}>{team.name}</span>
        <span className={styles.count}>{agents.length}</span>
      </div>
      {/* Floor tiles */}
      <div className={styles.floor}>
        <div className={styles.agents}>
          {agents.map((agent) => (
            <AgentNode
              key={agent.id}
              agent={agent}
              showDesk
              teamColor={team.color}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
