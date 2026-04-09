import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/card';
import { CategoryRevenue } from '@/types/dashboard';

interface CategoryPieChartProps {
  data: CategoryRevenue[];
}

const COLORS = ['#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b'];

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">카테고리별 매출</h3>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-zinc-400">
          데이터 없음
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={60}
                dataKey="revenue"
                nameKey="category"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`₩${value.toLocaleString()}`, '매출']}
              />
              <Legend
                iconSize={8}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ fontSize: '10px', color: '#a1a1aa' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
