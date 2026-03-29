import styles from './Desk.module.css'

interface Props {
  teamColor: string
}

export function Desk({ teamColor }: Props) {
  return (
    <div className={styles.desk}>
      {/* Chair */}
      <div className={styles.chair}>
        <svg viewBox="0 0 20 12" width={20} height={12} className={styles.chairSvg}>
          <rect x="2" y="0" width="16" height="3" rx="1" fill="#4a3728" />
          <rect x="4" y="3" width="2" height="9" fill="#3a2a1c" />
          <rect x="14" y="3" width="2" height="9" fill="#3a2a1c" />
          <rect x="3" y="8" width="14" height="3" rx="1" fill="#5a4738" />
        </svg>
      </div>
      {/* Desk surface */}
      <div className={styles.surface} style={{ borderTopColor: teamColor }}>
        <svg viewBox="0 0 48 20" width={48} height={20} className={styles.deskSvg}>
          {/* Desktop */}
          <rect x="0" y="0" width="48" height="4" rx="1" fill="#5c4033" />
          <rect x="0" y="0" width="48" height="2" fill="#6b4c3b" />
          {/* Legs */}
          <rect x="2" y="4" width="3" height="16" fill="#4a3728" />
          <rect x="43" y="4" width="3" height="16" fill="#4a3728" />
          {/* Shelf */}
          <rect x="6" y="12" width="36" height="2" fill="#4a3728" />
        </svg>
        {/* Monitor */}
        <div className={styles.monitor}>
          <svg viewBox="0 0 16 14" width={16} height={14}>
            <rect x="1" y="0" width="14" height="10" rx="1" fill="#2d333b" />
            <rect x="2" y="1" width="12" height="8" fill="#1a8cff" opacity="0.3" />
            {/* Screen content lines */}
            <rect x="3" y="2" width="8" height="1" fill="#58a6ff" opacity="0.5" />
            <rect x="3" y="4" width="6" height="1" fill="#3fb950" opacity="0.5" />
            <rect x="3" y="6" width="10" height="1" fill="#58a6ff" opacity="0.3" />
            {/* Stand */}
            <rect x="6" y="10" width="4" height="2" fill="#484f58" />
            <rect x="4" y="12" width="8" height="2" fill="#484f58" />
          </svg>
        </div>
      </div>
    </div>
  )
}
