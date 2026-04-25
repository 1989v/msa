import { apiClient, unwrap } from './client'
import type { LeaderboardEntry } from '@/types/api'

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const res = await apiClient.get<{
    code: string
    message: string
    data: LeaderboardEntry[]
  }>('/api/v1/leaderboard', { params: { limit } })
  return unwrap(res)
}
