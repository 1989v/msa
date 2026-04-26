import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="페이지를 찾지 못했습니다." back="/" />
      <div className="px-4 py-12 space-y-4 text-center">
        <p className="text-base text-ink-600">
          요청한 경로가 존재하지 않거나 권한이 없습니다.
        </p>
        <Link to="/">
          <Button>홈으로</Button>
        </Link>
      </div>
    </>
  )
}
