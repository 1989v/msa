import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ListRow } from '@kgd/design-system';
import { HealthDetail } from './HealthDetail';
import type { ServiceHealth } from '@admin/types/system';
import { cn } from '@admin/lib/utils';

interface ServiceCardProps {
  service: ServiceHealth;
}

const STATUS_COLOR: Record<ServiceHealth['status'], string> = {
  UP: 'bg-green-500',
  DOWN: 'bg-red-500',
  UNKNOWN: 'bg-yellow-500',
};

const STATUS_TEXT_CLS: Record<ServiceHealth['status'], string> = {
  UP: 'text-green-500',
  DOWN: 'text-red-500',
  UNKNOWN: 'text-yellow-500',
};

/**
 * ServiceCard — 서비스 health row.
 *
 * @kgd/design-system ListRow 를 base 로 사용 + expand 시 HealthDetail 토글.
 * - avatar: status dot
 * - primary: 서비스명
 * - secondary: ":<port>"
 * - value: status text (UP/DOWN/UNKNOWN, 색상 분기)
 * - trailing: chevron
 */
export function ServiceCard({ service }: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const dot = <span className={cn('h-2 w-2 rounded-full', STATUS_COLOR[service.status])} />;

  return (
    <div>
      <ListRow
        avatar={dot}
        primary={service.name}
        secondary={`:${service.port}`}
        value={
          <span className={cn('font-bold', STATUS_TEXT_CLS[service.status])}>
            {service.status}
          </span>
        }
        trailing={
          expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        }
        onClick={() => setExpanded((e) => !e)}
      />
      {expanded && (
        <div
          className={cn(
            'mt-2 rounded-md border border-zinc-200 dark:border-zinc-800',
            'px-4 py-3 bg-white/40 dark:bg-zinc-900/40',
          )}
        >
          {service.health ? (
            <HealthDetail health={service.health} />
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">헬스 정보를 가져올 수 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
