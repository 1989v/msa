import { Badge } from '@/components/ui/badge';
import type { HealthResponse } from '@/types/system';

interface HealthDetailProps {
  health: HealthResponse;
}

export function HealthDetail({ health }: HealthDetailProps) {
  const components = health.components ?? {};
  const entries = Object.entries(components);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400 py-1">상세 정보 없음</p>
    );
  }

  return (
    <div className="space-y-1 pt-2">
      {entries.map(([name, component]) => (
        <div key={name} className="flex items-center justify-between text-xs">
          <span className="text-zinc-600 dark:text-zinc-400 capitalize">{name}</span>
          <Badge
            variant={
              component.status === 'UP'
                ? 'default'
                : component.status === 'DOWN'
                ? 'destructive'
                : 'outline'
            }
            className={
              component.status === 'UP'
                ? 'bg-green-600 text-white dark:bg-green-600 dark:text-white'
                : undefined
            }
          >
            {component.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
