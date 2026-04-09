import { apiClient } from './client';
import type { EurekaApp, ServiceHealth } from '@/types/system';

const SERVICES = [
  { name: 'product-service', port: 8081 },
  { name: 'order-service', port: 8082 },
  { name: 'search-service', port: 8083 },
  { name: 'auth-service', port: 8087 },
  { name: 'gateway-service', port: 8080 },
  { name: 'code-dictionary-service', port: 8089 },
  { name: 'member-service', port: 8093 },
  { name: 'gifticon-service', port: 8086 },
  { name: 'wishlist-service', port: 8095 },
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

export async function fetchEurekaApps(): Promise<EurekaApp[]> {
  try {
    const res = await apiClient.get<EurekaAppsResponse>('/eureka/apps', {
      headers: { Accept: 'application/json' },
    });
    const apps = res.data.applications?.application ?? [];
    return apps.map((app) => ({
      name: app.name,
      instances: (app.instance ?? []).map((inst) => ({
        instanceId: inst.instanceId,
        hostName: inst.hostName,
        port: inst.port?.$ ?? 0,
        status: inst.status as ServiceHealth['status'],
        lastUpdatedTimestamp: inst.lastUpdatedTimestamp,
      })),
    }));
  } catch {
    return [];
  }
}

export async function fetchServiceHealthList(): Promise<ServiceHealth[]> {
  const eurekaApps = await fetchEurekaApps();
  const eurekaMap = new Map<string, 'UP' | 'DOWN' | 'UNKNOWN'>();

  for (const app of eurekaApps) {
    const anyUp = app.instances.some((i) => i.status === 'UP');
    eurekaMap.set(app.name.toLowerCase(), anyUp ? 'UP' : 'DOWN');
  }

  return SERVICES.map((svc) => {
    const eurekaStatus = eurekaMap.get(svc.name) ?? 'UNKNOWN';
    return {
      name: svc.name,
      port: svc.port,
      status: eurekaStatus,
      lastChecked: Date.now(),
    };
  });
}
