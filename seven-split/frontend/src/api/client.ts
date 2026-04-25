import axios, { AxiosError, AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types/api'

/**
 * 모든 호출에 X-User-Id (tenantId) 헤더 자동 주입.
 * - 운영: Gateway 가 JWT 검증 후 헤더 주입
 * - 로컬: useTenantId / SettingsPage 에서 localStorage 변경
 */
export const TENANT_STORAGE_KEY = 'seven-split.tenantId'
export const DEFAULT_TENANT_ID = 'local-dev'

export function readTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID
  return window.localStorage.getItem(TENANT_STORAGE_KEY) ?? DEFAULT_TENANT_ID
}

export function writeTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TENANT_STORAGE_KEY, tenantId)
}

const baseURL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? '' : '/api/seven-split')

export const apiClient = axios.create({
  baseURL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? {}
  // X-User-Id 강제 — Gateway 컨벤션
  ;(config.headers as Record<string, string>)['X-User-Id'] = readTenantId()
  return config
})

/** ApiResponse<T> 언래핑 — 비표준 응답이면 throw */
export function unwrap<T>(res: AxiosResponse<ApiResponse<T>>): T {
  const body = res.data
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new Error('Invalid ApiResponse shape')
  }
  return body.data
}

export interface ApiError {
  status: number
  code: string
  message: string
  cause?: unknown
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const data = err.response?.data as Partial<ApiResponse<unknown>> | undefined
    return {
      status: err.response?.status ?? 0,
      code: data?.code ?? 'NETWORK_ERROR',
      message: data?.message ?? err.message,
      cause: err,
    }
  }
  if (err instanceof Error) {
    return { status: 0, code: 'CLIENT_ERROR', message: err.message, cause: err }
  }
  return { status: 0, code: 'UNKNOWN', message: 'Unknown error', cause: err }
}
