import { AppLayout } from '@/components/Layout/AppLayout'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { OfficeGrid } from '@/components/OfficeGrid/OfficeGrid'
import { ProfilePanel } from '@/components/ProfilePanel/ProfilePanel'
import { NotificationPanel } from '@/components/Notification/NotificationPanel'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function App() {
  useKeyboardShortcuts()

  return (
    <>
      <AppLayout
        sidebar={<Sidebar />}
        main={<OfficeGrid />}
        panel={<ProfilePanel />}
      />
      <NotificationPanel />
    </>
  )
}

export default App
