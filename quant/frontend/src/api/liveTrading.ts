import { apiClient, unwrap } from './client'
import type { ApiResponse } from '@/types/api'

// Phase 3 실매매 API 클라이언트 (ADR-0037 / TG-P3-37).

export interface TwoFactorRegisterResponse {
  qrCodeOtpAuthUri: string
  backupCodes: string[]
}

export interface TwoFactorVerifyResponse {
  tokenHash: string
  expiresInSeconds: number
}

export interface LiveModeState {
  mode: 'DISABLED' | 'ENABLED' | 'SUSPENDED'
  activatedAt: string | null
  suspendReason: string | null
  suspendedAt: string | null
}

export interface RiskLimit {
  dailyLossLimitKrw: string | number
  dailyVolumeLimitKrw: string | number
  singleOrderMaxKrw: string | number
  updatedAt: string
}

export interface KillSwitchSnapshot {
  global: boolean
  tenant: boolean
  strategy: boolean
}

export interface AuditLogItem {
  eventType: string
  occurredAt: string
  payload: string
  currentHash: string
}

export const liveTradingApi = {
  async registerTwoFactor(): Promise<TwoFactorRegisterResponse> {
    return unwrap(await apiClient.post<ApiResponse<TwoFactorRegisterResponse>>('/api/v1/2fa/register'))
  },

  async verifyTwoFactor(totp: string): Promise<TwoFactorVerifyResponse> {
    return unwrap(
      await apiClient.post<ApiResponse<TwoFactorVerifyResponse>>('/api/v1/2fa/verify', { totp }),
    )
  },

  async getLiveMode(): Promise<LiveModeState> {
    return unwrap(await apiClient.get<ApiResponse<LiveModeState>>('/api/v1/live-mode'))
  },

  async toggleLiveMode(enabled: boolean, twoFaTokenHash: string): Promise<LiveModeState> {
    return unwrap(
      await apiClient.put<ApiResponse<LiveModeState>>('/api/v1/live-mode', { enabled, twoFaTokenHash }),
    )
  },

  async getRiskLimit(): Promise<RiskLimit> {
    return unwrap(await apiClient.get<ApiResponse<RiskLimit>>('/api/v1/risk-limit'))
  },

  async updateRiskLimit(body: {
    dailyLossLimitKrw: number
    dailyVolumeLimitKrw: number
    singleOrderMaxKrw: number
    twoFaTokenHash: string
  }): Promise<RiskLimit> {
    return unwrap(await apiClient.put<ApiResponse<RiskLimit>>('/api/v1/risk-limit', body))
  },

  async getKillSwitch(strategyId: string): Promise<KillSwitchSnapshot> {
    return unwrap(
      await apiClient.get<ApiResponse<KillSwitchSnapshot>>('/api/v1/kill-switch', {
        params: { strategyId },
      }),
    )
  },

  async toggleTenantKillSwitch(enabled: boolean, reason: string | null, twoFaTokenHash?: string) {
    return unwrap(
      await apiClient.put<ApiResponse<{ enabled: boolean }>>('/api/v1/kill-switch/tenant', {
        enabled,
        reason,
        twoFaTokenHash,
      }),
    )
  },

  async toggleStrategyKillSwitch(
    strategyId: string,
    enabled: boolean,
    reason: string | null,
    twoFaTokenHash?: string,
  ) {
    return unwrap(
      await apiClient.put<ApiResponse<{ enabled: boolean }>>(
        `/api/v1/kill-switch/strategy/${strategyId}`,
        { enabled, reason, twoFaTokenHash },
      ),
    )
  },

  async listAuditLog(limit = 100): Promise<AuditLogItem[]> {
    return unwrap(
      await apiClient.get<ApiResponse<AuditLogItem[]>>('/api/v1/audit-log', { params: { limit } }),
    )
  },
}
