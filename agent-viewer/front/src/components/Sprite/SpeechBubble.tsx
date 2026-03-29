import styles from './SpeechBubble.module.css'

interface Props {
  text: string
  visible: boolean
}

export function SpeechBubble({ text, visible }: Props) {
  if (!visible || !text) return null

  return (
    <div className={styles.bubble}>
      <span className={styles.text}>{text}</span>
      <div className={styles.tail} />
    </div>
  )
}
