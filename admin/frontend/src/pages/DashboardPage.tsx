import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/dashboard/StatCard';
import { OrderChart } from '@/components/dashboard/OrderChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { ServiceSummary } from '@/components/dashboard/ServiceSummary';
import {
  fetchTodayOrders,
  fetchTodayRevenue,
  fetchMemberCount,
  fetchDailyOrderStats,
  fetchCategoryRevenue,
} from '@/api/dashboard';
import { fetchServiceHealthList } from '@/api/system';

export function DashboardPage() {
  const { data: todayOrders = 0 } = useQuery({
    queryKey: ['todayOrders'],
    queryFn: fetchTodayOrders,
    refetchInterval: 300000,
  });

  const { data: todayRevenue = 0 } = useQuery({
    queryKey: ['todayRevenue'],
    queryFn: fetchTodayRevenue,
    refetchInterval: 300000,
  });

  const { data: memberCount = { newCount: 0, totalCount: 0 } } = useQuery({
    queryKey: ['memberCount'],
    queryFn: fetchMemberCount,
    refetchInterval: 300000,
  });

  const { data: dailyStats = [] } = useQuery({
    queryKey: ['dailyOrderStats'],
    queryFn: fetchDailyOrderStats,
    refetchInterval: 300000,
  });

  const { data: categoryRevenue = [] } = useQuery({
    queryKey: ['categoryRevenue'],
    queryFn: fetchCategoryRevenue,
    refetchInterval: 300000,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['serviceHealth'],
    queryFn: fetchServiceHealthList,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="오늘 주문" value={todayOrders} trend="neutral" />
        <StatCard
          label="오늘 매출"
          value={`₩${Number(todayRevenue).toLocaleString()}`}
          trend="neutral"
        />
        <StatCard label="신규 가입" value={memberCount.newCount} trend="neutral" />
        <StatCard label="총 회원" value={memberCount.totalCount} trend="neutral" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderChart data={dailyStats} />
        </div>
        <div>
          <CategoryPieChart data={categoryRevenue} />
        </div>
      </div>

      {/* Service summary */}
      <ServiceSummary services={services} />
    </div>
  );
}
