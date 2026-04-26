import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_TENANT_ID, readTenantId, writeTenantId } from '@/api/client'

/**
 * tenantId 를 localStorage 와 sync.
 * 변경 시 즉시 반영되도록 storage 이벤트 + custom 이벤트 구독.
 */
const CUSTOM_EVENT = 'seven-split:tenant-changed'

export function useTenantId(): {
  tenantId: string
  setTenantId: (value: string) => void
  reset: () => void
} {
  const [tenantId, setLocal] = useState<string>(() => readTenantId())

  useEffect(() => {
    function onChange() {
      setLocal(readTenantId())
    }
    window.addEventListener('storage', onChange)
    window.addEventListener(CUSTOM_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(CUSTOM_EVENT, onChange)
    }
  }, [])

  const setTenantId = useCallback((value: string) => {
    const trimmed = value.trim() || DEFAULT_TENANT_ID
    writeTenantId(trimmed)
    setLocal(trimmed)
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENT))
  }, [])

  const reset = useCallback(() => {
    setTenantId(DEFAULT_TENANT_ID)
  }, [setTenantId])

  return { tenantId, setTenantId, reset }
}
