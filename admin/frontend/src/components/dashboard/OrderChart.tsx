import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import type { DailyOrderStat } from '@/types/dashboard';

interface OrderChartProps {
  data: DailyOrderStat[];
}

export function OrderChart({ data }: OrderChartProps) {
  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">7일 주문 현황</h3>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-zinc-400">
          데이터 없음
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a1a1aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a1a1aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="orderCount"
                stroke="#a1a1aa"
                strokeWidth={2}
                fill="url(#colorOrders)"
                name="주문수"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
