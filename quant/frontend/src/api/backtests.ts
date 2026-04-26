import { apiClient, unwrap } from './client'
import type {
  BacktestRunResultView,
  BacktestRunSummaryView,
  RunBacktestRequest,
} from '@/types/api'

export async function submitBacktest(
  req: RunBacktestRequest,
): Promise<BacktestRunResultView> {
  const res = await apiClient.post<{
    code: string
    message: string
    data: BacktestRunResultView
  }>('/api/v1/backtests', req)
  return unwrap(res)
}

export async function listRuns(strategyId: string): Promise<BacktestRunSummaryView[]> {
  const res = await apiClient.get<{
    code: string
    message: string
    data: BacktestRunSummaryView[]
  }>(`/api/v1/strategies/${strategyId}/runs`)
  return unwrap(res)
}

export async function getRun(runId: string): Promise<BacktestRunResultView> {
  const res = await apiClient.get<{
    code: string
    message: string
    data: BacktestRunResultView
  }>(`/api/v1/runs/${runId}`)
  return unwrap(res)
}
