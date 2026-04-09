import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { StatCardData } from '@/types/dashboard';

interface StatCardProps extends StatCardData {}

export function StatCard({ label, value, change, trend = 'neutral' }: StatCardProps) {
  const trendIcon = {
    up: <TrendingUp className="h-4 w-4 text-green-500" />,
    down: <TrendingDown className="h-4 w-4 text-red-500" />,
    neutral: <Minus className="h-4 w-4 text-zinc-400" />,
  }[trend];

  const changeColor = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-zinc-400',
  }[trend];

  return (
    <Card className="p-4 space-y-2">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {trendIcon}
          <span className={`text-xs ${changeColor}`}>{Math.abs(change)}%</span>
        </div>
      )}
    </Card>
  );
}
