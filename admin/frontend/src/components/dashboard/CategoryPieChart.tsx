import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CategoryRevenue } from '@/types/dashboard';

interface CategoryPieChartProps {
  data: CategoryRevenue[];
}

// 디자인 시스템 다크 네이비 카드와 어울리는 청록/녹색 계열 (sample 2 톤)
const COLORS = [
  'oklch(0.72 0.19 145)', // profit green
  'oklch(0.78 0.14 180)', // teal
  'oklch(0.68 0.16 245)', // primary blue
  'oklch(0.74 0.16 90)',  // amber
  'oklch(0.65 0.15 300)', // violet
  'oklch(0.68 0.18 30)',  // orange
];

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <div
      style={{
        background: 'var(--ko-surface-1)',
        border: '1px solid var(--ko-border-subtle)',
        borderRadius: 'var(--ko-radius-lg)',
        padding: 'var(--ko-space-4) var(--ko-space-5)',
      }}
      className="space-y-3"
    >
      <h3
        className="text-sm font-medium"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        카테고리별 매출
      </h3>
      {data.length === 0 ? (
        <div
          className="h-48 flex items-center justify-center text-sm"
          style={{ color: 'var(--ko-text-muted)' }}
        >
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
                  background: 'var(--ko-surface-2)',
                  border: '1px solid var(--ko-border-subtle)',
                  borderRadius: 'var(--ko-radius-md)',
                  color: 'var(--ko-text-primary)',
                  fontSize: '12px',
                }}
                formatter={(value: unknown) => [
                  `₩${Number(value).toLocaleString()}`,
                  '매출',
                ]}
              />
              <Legend
                iconSize={8}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ fontSize: '11px', color: 'var(--ko-text-secondary)' }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
