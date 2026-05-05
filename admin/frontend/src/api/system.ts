import { apiClient } from './client';
import type { EurekaApp, ServiceHealth } from '@/types/system';

// 2026-04-10 (ADR-0019 Phase 1b): Eureka 제거 → K8s 네이티브 service discovery 로 전환.
// 2026-05-05: 게이트웨이에 actuator-<svc> 프록시 라우트 12 개 추가 → admin FE 가
// /svc/<name>/actuator/health 로 실제 UP/DOWN 직접 확인 가능. (gateway 자체는 /actuator/health)
const SERVICES = [
  { name: 'product', port: 8081 },
  { name: 'order', port: 8082 },
  { name: 'search', port: 8083 },
  { name: 'auth', port: 8087 },
  { name: 'gateway', port: 8080 },
  { name: 'code-dictionary', port: 8089 },
  { name: 'member', port: 8093 },
  { name: 'gifticon', port: 8086 },
  { name: 'wishlist', port: 8095 },
  { name: 'quant', port: 8094 },
  { name: 'analytics', port: 8090 },
  { name: 'experiment', port: 8091 },
];

interface EurekaAppsResponse {
  applications?: {
    application?: Array<{
      name: string;
      instance: Array<{
        instanceId: string;
        hostName: string;
        port: { $: number };
        status: string;
        lastUpdatedTimestamp: number;
      }>;
    }>;
  };
}

// Eureka 호환 stub — ADR-0019 Phase 1b 에서 Discovery 제거됨. 항상 빈 배열 반환.
export async function fetchEurekaApps(): Promise<EurekaApp[]> {
  return [];
}

import type { HealthResponse } from '@/types/system';

// 게이트웨이 actuator 프록시 라우트를 통해 각 서비스의 /actuator/health 를 호출.
// gateway 자체는 /actuator/health 직접 호출. 응답이 JSON 이 아니면 (예: portal-fe HTML
// catch-all 가로챔) UNKNOWN 처리하여 라우팅 오류를 가시화.
async function fetchActuatorHealth(svcName: string): Promise<{
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  health?: HealthResponse;
}> {
  const url = svcName === 'gateway' ? '/actuator/health' : `/svc/${svcName}/actuator/health`;
  try {
    const res = await apiClient.get<HealthResponse | string>(url, {
      timeout: 5000,
      headers: { Accept: 'application/json' },
    });
    // ingress 가 잘못 라우팅하면 portal-fe 의 HTML 이 반환됨 → 객체 아님
    if (typeof res.data !== 'object' || res.data === null) {
      // eslint-disable-next-line no-console
      console.warn(`[health] ${svcName}: non-JSON response (라우팅 오류 의심)`);
      return { status: 'UNKNOWN' };
    }
    const health = res.data as HealthResponse;
    const s = health.status;
    if (s === 'UP') return { status: 'UP', health };
    if (s === 'DOWN') return { status: 'DOWN', health };
    return { status: 'UNKNOWN', health };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[health] ${svcName} actuator check failed:`, (e as Error)?.message);
    return { status: 'DOWN' };
  }
}

export async function fetchServiceHealthList(): Promise<ServiceHealth[]> {
  // 12 개 서비스 병렬 health 조회. 응답 객체에서 components 까지 보존하여
  // ServiceCard 가 expand 시 detail 표시 가능.
  const results = await Promise.all(
    SERVICES.map(async (svc) => {
      const result = await fetchActuatorHealth(svc.name);
      return {
        name: svc.name,
        port: svc.port,
        status: result.status,
        health: result.health,
        lastChecked: Date.now(),
      };
    }),
  );
  return results;
}

