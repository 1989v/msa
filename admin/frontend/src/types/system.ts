export interface EurekaApp {
  name: string;
  instances: EurekaInstance[];
}

export interface EurekaInstance {
  instanceId: string;
  hostName: string;
  port: number;
  status: 'UP' | 'DOWN' | 'STARTING' | 'OUT_OF_SERVICE' | 'UNKNOWN';
  lastUpdatedTimestamp: number;
}

export interface HealthResponse {
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  components?: Record<string, HealthComponent>;
}

export interface HealthComponent {
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  details?: Record<string, unknown>;
}

export interface ServiceHealth {
  name: string;
  port: number;
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  health?: HealthResponse;
  lastChecked: number;
}
