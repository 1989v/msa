import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HealthDetail } from './HealthDetail';
import type { ServiceHealth } from '@/types/system';
import { cn } from '@/lib/utils';

interface ServiceCardProps {
  service: ServiceHealth;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusDot = (
    <span
      className={cn(
        'h-2 w-2 rounded-full shrink-0',
        service.status === 'UP'
          ? 'bg-green-500'
          : service.status === 'DOWN'
          ? 'bg-red-500'
          : 'bg-yellow-500'
      )}
    />
  );

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          {statusDot}
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {service.name}
          </span>
          <Badge variant="outline" className="text-xs">
            :{service.port}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              service.status === 'UP'
                ? 'default'
                : service.status === 'DOWN'
                ? 'destructive'
                : 'outline'
            }
            className={
              service.status === 'UP'
                ? 'bg-green-600 text-white dark:bg-green-600 dark:text-white'
                : undefined
            }
          >
            {service.status}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </button>
      {expanded && service.health && (
        <div className="px-4 pb-3 border-t border-zinc-200 dark:border-zinc-800">
          <HealthDetail health={service.health} />
        </div>
      )}
      {expanded && !service.health && (
        <div className="px-4 pb-3 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">헬스 정보를 가져올 수 없습니다</p>
        </div>
      )}
    </Card>
  );
}
