import { apiClient, unwrap } from './client'
import type { BacktestRunSummaryView, DashboardOverview } from '@/types/api'

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await apiClient.get<{
    code: string
    message: string
    data: DashboardOverview
  }>('/api/v1/dashboard/overview')
  return unwrap(res)
}

export async function getDashboardExecutions(): Promise<BacktestRunSummaryView[]> {
  const res = await apiClient.get<{
    code: string
    message: string
    data: BacktestRunSummaryView[]
  }>('/api/v1/dashboard/executions')
  return unwrap(res)
}
