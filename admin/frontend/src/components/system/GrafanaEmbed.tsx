import { useState } from 'react';
import { cn } from '@/lib/utils';

const DASHBOARDS = [
  { id: 'jvm-overview', label: 'JVM', uid: 'jvm-overview' },
  { id: 'http-overview', label: 'HTTP', uid: 'http-overview' },
  { id: 'service-overview', label: '서비스 현황', uid: 'service-overview' },
];

interface GrafanaEmbedProps {
  baseUrl?: string;
}

export function GrafanaEmbed({ baseUrl = 'http://localhost:3000' }: GrafanaEmbedProps) {
  const [activeTab, setActiveTab] = useState(DASHBOARDS[0].id);
  const activeDashboard = DASHBOARDS.find((d) => d.id === activeTab)!;

  const iframeUrl = `${baseUrl}/d/${activeDashboard.uid}?orgId=1&theme=dark&kiosk`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">메트릭 대시보드</h2>
        <div className="flex gap-1 ml-4">
          {DASHBOARDS.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveTab(d.id)}
              className={cn(
                'px-3 py-1 text-sm rounded-md transition-colors',
                activeTab === d.id
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <iframe
          src={iframeUrl}
          width="100%"
          height="600"
          style={{ border: 'none' }}
          title={`Grafana - ${activeDashboard.label}`}
        />
      </div>
    </div>
  );
}
