import { useState } from 'react'
import type { Agent } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import { SpeechBubble } from '@/components/Sprite/SpeechBubble'
import { Desk } from './Desk'
import styles from './AgentNode.module.css'

interface Props {
  agent: Agent
  compact?: boolean
  showDesk?: boolean
  walking?: boolean
  teamColor?: string
}

export function AgentNode({ agent, compact = false, showDesk = false, walking = false, teamColor = '#30363d' }: Props) {
  const [hovered, setHovered] = useState(false)
  const selectAgent = useAppStore((s) => s.selectAgent)
  const selectedAgentId = useAppStore((s) => s.selectedAgentId)
  const isSelected = selectedAgentId === agent.id

  return (
    <div
      className={`${styles.node} ${isSelected ? styles.selected : ''} ${compact ? styles.compact : ''} ${walking ? styles.walking : ''}`}
      onClick={() => selectAgent(agent.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.spriteWrapper}>
        <SpeechBubble
          text={agent.speechBubble ?? agent.role}
          visible={hovered}
        />
        <div className={showDesk ? styles.seated : ''}>
          <PixelSprite
            type={agent.spriteType}
            status={agent.status}
            size={compact ? 24 : 32}
          />
        </div>
      </div>

      {showDesk && <Desk teamColor={teamColor} />}

      {!compact && (
        <span className={styles.name}>{agent.name}</span>
      )}
      <div className={`${styles.statusIndicator} ${styles[agent.status]}`} />
    </div>
  )
}
