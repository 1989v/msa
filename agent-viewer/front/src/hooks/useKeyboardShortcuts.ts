import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

export function useKeyboardShortcuts() {
  const setViewMode = useAppStore((s) => s.setViewMode)
  const selectAgent = useAppStore((s) => s.selectAgent)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      switch (e.key) {
        case '1':
          setViewMode('session')
          break
        case '2':
          setViewMode('team')
          break
        case '3':
          setViewMode('task')
          break
        case 'Escape':
          selectAgent(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setViewMode, selectAgent])
}
