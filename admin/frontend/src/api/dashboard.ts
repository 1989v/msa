import { apiClient } from './client';
import type { DailyOrderStat, CategoryRevenue } from '@/types/dashboard';

export async function fetchTodayOrders(): Promise<number> {
  try {
    const res = await apiClient.get<{ data: number }>('/api/v1/orders/stats/today');
    return res.data.data ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchTodayRevenue(): Promise<number> {
  try {
    const res = await apiClient.get<{ data: number }>('/api/v1/orders/stats/revenue/today');
    return res.data.data ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchMemberCount(): Promise<{ newCount: number; totalCount: number }> {
  try {
    const res = await apiClient.get<{ data: { newCount: number; totalCount: number } }>(
      '/api/members/stats/count'
    );
    return res.data.data ?? { newCount: 0, totalCount: 0 };
  } catch {
    return { newCount: 0, totalCount: 0 };
  }
}

export async function fetchDailyOrderStats(): Promise<DailyOrderStat[]> {
  try {
    const res = await apiClient.get<{ data: DailyOrderStat[] }>(
      '/api/v1/orders/stats/daily?days=7'
    );
    return res.data.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchCategoryRevenue(): Promise<CategoryRevenue[]> {
  try {
    const res = await apiClient.get<{ data: CategoryRevenue[] }>(
      '/api/v1/orders/stats/by-category'
    );
    return res.data.data ?? [];
  } catch {
    return [];
  }
}
