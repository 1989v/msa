export interface StatCardData {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DailyOrderStat {
  date: string;
  orderCount: number;
  revenue: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
}
