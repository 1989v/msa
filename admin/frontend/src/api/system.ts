import { apiClient } from './client';
import type { EurekaApp, ServiceHealth } from '@/types/system';

// 2026-04-10 (ADR-0019 Phase 1b): Eureka 제거 → K8s 네이티브 service discovery 로 전환.
// Pod health 는 K8s liveness/readiness probe 가 관리. admin FE 는 게이트웨이 actuator
// 프록시 라우트가 없으면 직접 health 확인 불가 → status="K8S_MANAGED" 로 표시 + 안내.
// (TODO: 게이트웨이에 /svc/<name>/actuator/health 프록시 라우트 추가 시 진짜 health 표시)
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
  { name: 'analytics', port: 8084 },
  { name: 'experiment', port: 8085 },
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

export async function fetchServiceHealthList(): Promise<ServiceHealth[]> {
  // K8s liveness/readiness probe 가 pod health 관리. admin FE 는 게이트웨이 actuator
  // 프록시 라우트 없이는 직접 확인 불가 → UNKNOWN 으로 표시. UP/DOWN 카운트 대신
  // SystemPage 가 "K8s 관리" 안내 표시.
  return SERVICES.map((svc) => {
    return {
      name: svc.name,
      port: svc.port,
      status: 'UNKNOWN' as const,
      lastChecked: Date.now(),
    };
  });
}
