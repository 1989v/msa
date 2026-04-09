import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ServiceHealth } from '@/types/system';

interface ServiceSummaryProps {
  services: ServiceHealth[];
}

export function ServiceSummary({ services }: ServiceSummaryProps) {
  const upCount = services.filter((s) => s.status === 'UP').length;
  const downCount = services.filter((s) => s.status !== 'UP').length;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">서비스 상태</h3>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-green-600 text-white dark:bg-green-600 dark:text-white">
            UP {upCount}
          </Badge>
          {downCount > 0 && (
            <Badge variant="destructive">DOWN {downCount}</Badge>
          )}
          <Link
            to="/admin/system"
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
          >
            상세 보기
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center gap-2 rounded-md px-3 py-2 bg-zinc-50 dark:bg-zinc-800"
          >
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                service.status === 'UP'
                  ? 'bg-green-500'
                  : service.status === 'DOWN'
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`}
            />
            <span className="text-xs truncate text-zinc-700 dark:text-zinc-300">
              {service.name.replace('-service', '')}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
