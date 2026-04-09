import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServiceCard } from '@/components/system/ServiceCard';
import { GrafanaEmbed } from '@/components/system/GrafanaEmbed';
import { fetchServiceHealthList } from '@/api/system';

export function SystemPage() {
  const { data: services = [], dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['systemServiceHealth'],
    queryFn: fetchServiceHealthList,
    refetchInterval: 30000,
  });

  const upCount = services.filter((s) => s.status === 'UP').length;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR') : '-';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">시스템</h1>
          <Badge variant={upCount === services.length ? 'default' : 'destructive'}>
            {upCount} / {services.length} UP
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>마지막 업데이트: {lastUpdated}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {services.map((service) => (
          <ServiceCard key={service.name} service={service} />
        ))}
      </div>

      <GrafanaEmbed />
    </div>
  );
}
