import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import type { ServiceHealth } from '@/types/system';

interface ServiceSummaryProps {
  services: ServiceHealth[];
}

/**
 * ServiceSummary — 대시보드 서비스 상태 카드.
 *
 * @kgd/design-system 토큰을 직접 사용해 sample 2 다크 네이비 카드 톤으로 정렬.
 * status dot 색상은 OKLCH 기반.
 */
export function ServiceSummary({ services }: ServiceSummaryProps) {
  const upCount = services.filter((s) => s.status === 'UP').length;
  const downCount = services.filter((s) => s.status === 'DOWN').length;
  const unknownCount = services.filter((s) => s.status === 'UNKNOWN').length;

  return (
    <div
      style={{
        background: 'var(--ko-surface-1)',
        border: '1px solid var(--ko-border-subtle)',
        borderRadius: 'var(--ko-radius-lg)',
        padding: 'var(--ko-space-4) var(--ko-space-5)',
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: 'var(--ko-text-muted)' }}>
          서비스 상태 ({services.length})
        </h3>
        <div className="flex items-center gap-2">
          {upCount > 0 && (
            <Badge
              variant="default"
              style={{
                background: 'var(--ko-status-profit)',
                color: 'oklch(0.18 0.025 252)',
                fontWeight: 700,
              }}
            >
              UP {upCount}
            </Badge>
          )}
          {downCount > 0 && (
            <Badge
              variant="destructive"
              style={{ background: 'var(--ko-status-loss)', color: '#fff' }}
            >
              DOWN {downCount}
            </Badge>
          )}
          {unknownCount > 0 && (
            <Badge
              variant="secondary"
              style={{
                background: 'var(--ko-surface-2)',
                color: 'var(--ko-text-secondary)',
              }}
            >
              UNKNOWN {unknownCount}
            </Badge>
          )}
          <Link
            to="/admin/system"
            className="text-xs underline"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            상세 보기
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {services.map((service) => {
          const dotColor =
            service.status === 'UP'
              ? 'var(--ko-status-profit)'
              : service.status === 'DOWN'
                ? 'var(--ko-status-loss)'
                : 'var(--ko-status-warning)';
          return (
            <div
              key={service.name}
              className="flex items-center gap-2 px-3 py-2"
              style={{
                background: 'var(--ko-surface-2)',
                borderRadius: 'var(--ko-radius-md)',
                border: '1px solid var(--ko-border-subtle)',
              }}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: dotColor }}
              />
              <span
                className="text-xs truncate"
                style={{ color: 'var(--ko-text-primary)' }}
              >
                {service.name.replace('-service', '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
