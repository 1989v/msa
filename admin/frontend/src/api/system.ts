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

// 게이트웨이 actuator 프록시 라우트 (gateway/application.yml: actuator-<svc>) 를 통해
// 각 서비스의 /actuator/health 를 호출. gateway 자체는 /actuator/health 직접 호출.
async function fetchActuatorHealth(svcName: string): Promise<'UP' | 'DOWN' | 'UNKNOWN'> {
  const url = svcName === 'gateway' ? '/actuator/health' : `/svc/${svcName}/actuator/health`;
  try {
    const res = await apiClient.get<{ status?: string }>(url, { timeout: 3000 });
    const s = res.data?.status;
    if (s === 'UP') return 'UP';
    if (s === 'DOWN') return 'DOWN';
    return 'UNKNOWN';
  } catch {
    return 'DOWN';
  }
}

export async function fetchServiceHealthList(): Promise<ServiceHealth[]> {
  // 12 개 서비스 병렬 health 조회. 실패는 DOWN 으로 처리.
  const results = await Promise.all(
    SERVICES.map(async (svc) => ({
      name: svc.name,
      port: svc.port,
      status: await fetchActuatorHealth(svc.name),
      lastChecked: Date.now(),
    })),
  );
  return results;
}

