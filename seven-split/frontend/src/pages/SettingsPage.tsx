import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { useTenantId } from '@/hooks/useTenantId'

export function SettingsPage() {
  const { tenantId, setTenantId, reset } = useTenantId()
  const [draft, setDraft] = useState(tenantId)
  const [saved, setSaved] = useState(false)

  function save() {
    setTenantId(draft)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <PageHeader title="설정" back />
      <div className="px-4 py-4 space-y-6">
        <Card className="space-y-3">
          <CardHeader>
            <CardTitle>tenantId</CardTitle>
          </CardHeader>
          <p className="text-sm text-ink-600">
            로컬 개발에서 X-User-Id 헤더로 사용됩니다. 운영에서는 Gateway 가 자동 주입합니다.
          </p>
          <div>
            <Label htmlFor="tenant">현재 tenantId</Label>
            <Input
              id="tenant"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>저장</Button>
            <Button
              variant="ghost"
              onClick={() => {
                reset()
                setDraft('local-dev')
              }}
            >
              기본값으로
            </Button>
          </div>
          {saved && (
            <p role="status" className="text-sm text-pnl-up">
              저장되었습니다. 이후 요청부터 적용됩니다.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PWA 설치</CardTitle>
          </CardHeader>
          <p className="text-sm text-ink-600 mt-2">
            iOS Safari: 공유 → 홈 화면에 추가. Chrome/Edge: 주소창의 설치 버튼.
          </p>
        </Card>
      </div>
    </>
  )
}
