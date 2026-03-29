import { AppLayout } from '@/components/Layout/AppLayout'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { OfficeGrid } from '@/components/OfficeGrid/OfficeGrid'
import { ProfilePanel } from '@/components/ProfilePanel/ProfilePanel'
import { NotificationPanel } from '@/components/Notification/NotificationPanel'
import { ToastContainer } from '@/components/Toast/ToastContainer'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAutoCleanup } from '@/hooks/useAutoCleanup'

function App() {
  useKeyboardShortcuts()
  useWebSocket()
  useAutoCleanup()

  return (
    <>
      <AppLayout
        sidebar={<Sidebar />}
        main={<OfficeGrid />}
        panel={<ProfilePanel />}
      />
      <NotificationPanel />
      <ToastContainer />
    </>
  )
}

export default App
