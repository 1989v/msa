import styles from './OfficeProp.module.css'

type PropType = 'plant' | 'cooler' | 'bookshelf' | 'whiteboard'

const PROPS: Record<PropType, { emoji: string; label: string }> = {
  plant: { emoji: '🪴', label: 'Plant' },
  cooler: { emoji: '🚰', label: 'Water Cooler' },
  bookshelf: { emoji: '📚', label: 'Bookshelf' },
  whiteboard: { emoji: '📋', label: 'Whiteboard' },
}

interface Props {
  type: PropType
}

export function OfficeProp({ type }: Props) {
  const prop = PROPS[type]
  return (
    <div className={styles.prop} title={prop.label}>
      <span className={styles.emoji}>{prop.emoji}</span>
    </div>
  )
}

// Deterministically pick props for a team based on agent count
export function getPropsForTeam(agentCount: number): PropType[] {
  const props: PropType[] = []
  if (agentCount >= 2) props.push('plant')
  if (agentCount >= 4) props.push('cooler')
  if (agentCount >= 6) props.push('bookshelf')
  return props
}
