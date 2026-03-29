import type { AgentStatus } from '@/types'
import { getSpriteConfig } from '@/utils/spriteConfig'
import styles from './PixelSprite.module.css'

interface Props {
  type: string
  status: AgentStatus
  size?: number
}

export function PixelSprite({ type, status, size = 32 }: Props) {
  const config = getSpriteConfig(type)
  return (
    <div
      className={`${styles.sprite} ${styles[status]}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        className={styles.svg}
      >
        {/* Hair / Hat */}
        <rect x="5" y="1" width="6" height="2" fill={config.color} />
        <rect x="4" y="2" width="8" height="1" fill={config.color} />

        {/* Head */}
        <rect x="5" y="3" width="6" height="4" fill={config.skinColor} />
        {/* Eyes */}
        <rect x="6" y="4" width="1" height="1" fill="#2d333b" />
        <rect x="9" y="4" width="1" height="1" fill="#2d333b" />
        {/* Mouth */}
        <rect x="7" y="6" width="2" height="1" fill="#c4956a" />

        {/* Body */}
        <rect x="4" y="7" width="8" height="4" fill={config.color} />
        <rect x="6" y="7" width="4" height="1" fill={config.accentColor} />

        {/* Arms */}
        <rect x="3" y="8" width="1" height="3" fill={config.skinColor} />
        <rect x="12" y="8" width="1" height="3" fill={config.skinColor} />

        {/* Legs */}
        <rect x="5" y="11" width="2" height="3" fill={config.accentColor} />
        <rect x="9" y="11" width="2" height="3" fill={config.accentColor} />

        {/* Feet */}
        <rect x="4" y="14" width="3" height="1" fill="#2d333b" />
        <rect x="9" y="14" width="3" height="1" fill="#2d333b" />
      </svg>

      {/* Status effects */}
      {status === 'thinking' && (
        <div className={styles.thinkingEffect}>
          <span className={styles.questionMark}>?</span>
        </div>
      )}
      {status === 'working' && (
        <div className={styles.workingEffect}>
          <span className={styles.sparkle}>✦</span>
        </div>
      )}
    </div>
  )
}
