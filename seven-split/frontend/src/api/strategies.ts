import { apiClient, unwrap } from './client'
import type {
  CreateStrategyRequest,
  CreateStrategyResponse,
  StrategyDetailView,
  StrategySummaryView,
} from '@/types/api'

const BASE = '/api/v1/strategies'

export async function createStrategy(
  req: CreateStrategyRequest,
): Promise<CreateStrategyResponse> {
  const res = await apiClient.post<{ code: string; message: string; data: CreateStrategyResponse }>(
    BASE,
    req,
  )
  return unwrap(res)
}

export async function listStrategies(): Promise<StrategySummaryView[]> {
  const res = await apiClient.get<{ code: string; message: string; data: StrategySummaryView[] }>(
    BASE,
  )
  return unwrap(res)
}

export async function getStrategy(id: string): Promise<StrategyDetailView> {
  const res = await apiClient.get<{ code: string; message: string; data: StrategyDetailView }>(
    `${BASE}/${id}`,
  )
  return unwrap(res)
}

export type StrategyPatch = Partial<{
  status: 'PAUSED' | 'ACTIVE'
  // 파라미터 변경 등은 추후 확장
}>

export async function patchStrategy(
  id: string,
  patch: StrategyPatch,
): Promise<StrategyDetailView> {
  const res = await apiClient.patch<{
    code: string
    message: string
    data: StrategyDetailView
  }>(`${BASE}/${id}`, patch)
  return unwrap(res)
}
