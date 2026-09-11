import { apiClient } from './client';
import type { EurekaApp, ServiceHealth } from '@/types/system';

// 2026-04-10 (ADR-0019 Phase 1b): Eureka 제거 → K8s 네이티브 service discovery 로 전환.
// 2026-05-05: 게이트웨이에 actuator-<svc> 프록시 라우트 12 개 추가 → admin FE 가
// /svc/<name>/actuator/health 로 실제 UP/DOWN 직접 확인 가능. (gateway 자체는 /actuator/health)
const SERVICES = [
  // ADR-0093 — 상주 백엔드 파드 10 개. 폴드된 도메인 이름(product·order·member…)이 아니라
  // **파드 이름**으로 센다. 도메인 이름으로 두면 한 파드가 여러 줄로 중복되고, 폴드가 바뀔 때마다
  // 목록이 어긋난다 — 실제로 code-dictionary 가 atlas 로 바뀐 뒤 그 줄이 계속 DOWN 이었다.
  { name: 'gateway', port: 8080 },
  { name: 'commerce', port: 8085 },
  { name: 'account', port: 8093 },
  { name: 'engagement', port: 8091 },
  { name: 'sideapp', port: 8095 },
  { name: 'content', port: 8097 },
  { name: 'atlas', port: 8089 },
  { name: 'search', port: 8083 },
  { name: 'auth', port: 8087 },
  { name: 'analytics', port: 8090 },
];

// ADR-0019 Phase 1b (2026-04-10) 에서 Discovery 제거됨. EurekaAppsResponse interface 도
// 함께 삭제. UI 호환을 위한 stub 만 유지.

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
  // 상주 파드 병렬 health 조회. 응답 객체에서 components 까지 보존하여
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

