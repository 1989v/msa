import { useEffect, useState } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const DEFAULT_GRAFANA_URL = 'http://localhost:3000';
const DASHBOARDS = [
  { id: 'jvm-overview', label: 'JVM Overview' },
  { id: 'http-overview', label: 'HTTP Overview' },
  { id: 'service-overview', label: '서비스 현황' },
];

interface GrafanaEmbedProps {
  baseUrl?: string;
}

/**
 * GrafanaEmbed — Grafana 대시보드 임베드.
 *
 * Grafana 가 클러스터에 미배포된 환경에서는 iframe 이 빈 화면 → 사용자에게 "안 뜬다"
 * 로 보임. baseUrl 가용성을 먼저 확인한 뒤 미배포 시 안내 + 배포 명령 + Prometheus
 * 직접 조회 링크를 표시. 배포된 경우 iframe 으로 임베드.
 */
export function GrafanaEmbed({ baseUrl = DEFAULT_GRAFANA_URL }: GrafanaEmbedProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState(DASHBOARDS[0].id);

  useEffect(() => {
    let cancelled = false;
    // no-cors HEAD — cross-origin 응답 status 는 못 보지만 fetch 가 throw 하지 않으면
    // 적어도 Grafana 호스트가 반응함을 의미. timeout 은 없으므로 reject 만 의존.
    fetch(`${baseUrl}/api/health`, { method: 'GET', mode: 'no-cors' })
      .then(() => {
        if (!cancelled) setAvailable(true);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  if (available === null) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">메트릭 대시보드</h2>
        <Card className="p-6 text-sm text-zinc-500">Grafana 가용성 확인 중…</Card>
      </section>
    );
  }

  if (available === false) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">메트릭 대시보드</h2>
        <Card className="p-6 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-3 text-sm flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Grafana 가 배포되지 않았습니다 ({baseUrl})
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                각 서비스의 Prometheus 엔드포인트는 정상 노출 중. Grafana / Prometheus
                를 클러스터에 배포하면 이 영역에 대시보드가 임베드됩니다.
              </p>
              <div className="space-y-1 text-xs font-mono bg-white dark:bg-zinc-900 rounded p-3 border border-amber-200 dark:border-amber-800">
                <div className="text-zinc-500"># Prometheus + Grafana 배포 (예시)</div>
                <div>helm install prometheus prometheus-community/kube-prometheus-stack \</div>
                <div>&nbsp;&nbsp;-n monitoring --create-namespace</div>
                <div className="text-zinc-500 mt-2"># 또는 각 서비스 raw 메트릭 직접 조회</div>
                <div>curl http://localhost/svc/product/actuator/prometheus</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {DASHBOARDS.map((d) => (
            <a
              key={d.id}
              href={`${baseUrl}/d/${d.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <span className="text-zinc-600 dark:text-zinc-400">{d.label}</span>
              <ExternalLink className="h-3 w-3 text-zinc-400" />
            </a>
          ))}
        </div>
      </section>
    );
  }

  // available === true
  const iframeUrl = `${baseUrl}/d/${activeTab}?orgId=1&theme=dark&kiosk`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">메트릭 대시보드</h2>
        <div className="flex gap-1">
          {DASHBOARDS.map((d) => (
            <Button
              key={d.id}
              variant={activeTab === d.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(d.id)}
            >
              {d.label}
            </Button>
          ))}
          <a
            href={baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button variant="outline" size="sm" className="gap-1 inline-flex items-center">
              열기 <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <iframe
          src={iframeUrl}
          width="100%"
          height="600"
          style={{ border: 'none' }}
          title={`Grafana - ${activeTab}`}
        />
      </div>
    </section>
  );
}
