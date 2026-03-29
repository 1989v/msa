import type { ReactNode } from 'react'
import { Header } from './Header'
import styles from './AppLayout.module.css'

interface Props {
  sidebar: ReactNode
  main: ReactNode
  panel: ReactNode
}

export function AppLayout({ sidebar, main, panel }: Props) {
  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.body}>
        <aside className={styles.sidebar}>{sidebar}</aside>
        <main className={styles.main}>{main}</main>
        <aside className={styles.panel}>{panel}</aside>
      </div>
    </div>
  )
}
