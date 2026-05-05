import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { liveTradingApi } from '@/api/liveTrading'

/**
 * Phase 3 실매매 진입 페이지 — `/quant/live-trading` (ADR-0037 / TG-P3-37).
 *
 * 4 패널:
 * 1. 2FA 등록 (QR + 백업 코드)
 * 2. live-mode 토글 (2FA 검증 토큰 redeem)
 * 3. risk-limit 슬라이더 (2FA 토큰 redeem)
 * 4. kill-switch (tenant + strategy)
 */
export function LiveTradingPage() {
  return (
    <>
      <PageHeader title="실매매 (Phase 3)" back />
      <div className="px-4 py-4 space-y-4">
        <WarningBanner />
        <TwoFactorPanel />
        <LiveModePanel />
        <RiskLimitPanel />
        <KillSwitchPanel />
      </div>
    </>
  )
}

function WarningBanner() {
  return (
    <Card className="border-pnl-down/40 bg-pnl-down/10">
      <p className="text-sm text-ink-900 leading-relaxed">
        ⚠️ 실매매는 실제 자본으로 거래소 주문을 실행합니다. 사용 전 약관과 일일 한도를
        반드시 확인하세요. Phase 3 Beta — 빗썸/업비트만 지원, Bybit/OKX 는 GA 단계 추가.
      </p>
    </Card>
  )
}

function TwoFactorPanel() {
  const [registered, setRegistered] = useState<{ qr: string; backupCodes: string[] } | null>(null)
  const [totp, setTotp] = useState('')
  const [verified, setVerified] = useState<{ tokenHash: string } | null>(null)

  const registerMut = useMutation({
    mutationFn: () => liveTradingApi.registerTwoFactor(),
    onSuccess: (d) => setRegistered({ qr: d.qrCodeOtpAuthUri, backupCodes: d.backupCodes }),
  })
  const verifyMut = useMutation({
    mutationFn: (code: string) => liveTradingApi.verifyTwoFactor(code),
    onSuccess: (d) => setVerified({ tokenHash: d.tokenHash }),
  })

  return (
    <Card className="space-y-3">
      <CardHeader>
        <CardTitle>1. 2FA 등록 / 검증</CardTitle>
      </CardHeader>
      {!registered && (
        <Button onClick={() => registerMut.mutate()} disabled={registerMut.isPending}>
          2FA 등록
        </Button>
      )}
      {registered && (
        <>
          <p className="text-xs text-ink-600 break-all">{registered.qr}</p>
          <p className="text-xs text-ink-600">
            ⚠️ 백업 코드 (1회용, 안전한 곳에 보관):
          </p>
          <ul className="text-xs font-mono text-ink-900 grid grid-cols-2 gap-1">
            {registered.backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="totp">TOTP 6자리</Label>
            <Input
              id="totp"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <Button
              onClick={() => verifyMut.mutate(totp)}
              disabled={totp.length !== 6 || verifyMut.isPending}
            >
              검증
            </Button>
          </div>
          {verified && (
            <p className="text-xs text-pnl-up break-all">
              ✓ 토큰 발급 (5분 유효): {verified.tokenHash.slice(0, 16)}…
            </p>
          )}
        </>
      )}
    </Card>
  )
}

function LiveModePanel() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['live-mode'],
    queryFn: () => liveTradingApi.getLiveMode(),
  })
  const [tokenHash, setTokenHash] = useState('')
  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => liveTradingApi.toggleLiveMode(enabled, tokenHash),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live-mode'] }),
  })

  return (
    <Card className="space-y-3">
      <CardHeader>
        <CardTitle>2. Live Mode</CardTitle>
      </CardHeader>
      <p className="text-sm text-ink-600">
        현재 상태: <strong>{data?.mode ?? '...'}</strong>
      </p>
      <Input
        placeholder="2FA 토큰 hash"
        value={tokenHash}
        onChange={(e) => setTokenHash(e.target.value)}
      />
      <div className="flex gap-2">
        <Button onClick={() => toggleMut.mutate(true)} disabled={!tokenHash}>활성화</Button>
        <Button variant="ghost" onClick={() => toggleMut.mutate(false)} disabled={!tokenHash}>
          비활성화
        </Button>
      </div>
    </Card>
  )
}

function RiskLimitPanel() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['risk-limit'],
    queryFn: () => liveTradingApi.getRiskLimit(),
  })
  const [loss, setLoss] = useState('')
  const [vol, setVol] = useState('')
  const [single, setSingle] = useState('')
  const [tokenHash, setTokenHash] = useState('')
  const updateMut = useMutation({
    mutationFn: () =>
      liveTradingApi.updateRiskLimit({
        dailyLossLimitKrw: Number(loss),
        dailyVolumeLimitKrw: Number(vol),
        singleOrderMaxKrw: Number(single),
        twoFaTokenHash: tokenHash,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-limit'] }),
  })

  return (
    <Card className="space-y-3">
      <CardHeader>
        <CardTitle>3. Risk Limit (KRW)</CardTitle>
      </CardHeader>
      <p className="text-xs text-ink-600">
        현재: 일일 손실 {data?.dailyLossLimitKrw ?? '-'} / 일일 거래량 {data?.dailyVolumeLimitKrw ?? '-'} /
        단일 주문 {data?.singleOrderMaxKrw ?? '-'}
      </p>
      <Input placeholder="일일 손실 한도" value={loss} onChange={(e) => setLoss(e.target.value)} />
      <Input placeholder="일일 거래량 한도" value={vol} onChange={(e) => setVol(e.target.value)} />
      <Input placeholder="단일 주문 최대" value={single} onChange={(e) => setSingle(e.target.value)} />
      <Input placeholder="2FA 토큰 hash" value={tokenHash} onChange={(e) => setTokenHash(e.target.value)} />
      <Button
        onClick={() => updateMut.mutate()}
        disabled={!loss || !vol || !single || !tokenHash}
      >
        한도 변경
      </Button>
    </Card>
  )
}

function KillSwitchPanel() {
  const [strategyId, setStrategyId] = useState('')
  const [reason, setReason] = useState('')
  const [tokenHash, setTokenHash] = useState('')
  const tenantMut = useMutation({
    mutationFn: (enabled: boolean) =>
      liveTradingApi.toggleTenantKillSwitch(enabled, reason || null, tokenHash || undefined),
  })
  const strategyMut = useMutation({
    mutationFn: (enabled: boolean) =>
      liveTradingApi.toggleStrategyKillSwitch(strategyId, enabled, reason || null, tokenHash || undefined),
  })

  return (
    <Card className="space-y-3">
      <CardHeader>
        <CardTitle>4. Kill Switch</CardTitle>
      </CardHeader>
      <p className="text-xs text-ink-600">활성화는 2FA 불필요. 해제(OFF) 시 2FA 토큰 필수.</p>
      <Input placeholder="reason (선택)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Input
        placeholder="2FA 토큰 hash (해제 시)"
        value={tokenHash}
        onChange={(e) => setTokenHash(e.target.value)}
      />
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Tenant 전체</h4>
        <div className="flex gap-2">
          <Button onClick={() => tenantMut.mutate(true)}>비상 정지 ON</Button>
          <Button variant="ghost" onClick={() => tenantMut.mutate(false)} disabled={!tokenHash}>
            해제
          </Button>
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t border-ink-100">
        <h4 className="text-sm font-semibold">Strategy 단일</h4>
        <Input
          placeholder="strategy UUID"
          value={strategyId}
          onChange={(e) => setStrategyId(e.target.value)}
        />
        <div className="flex gap-2">
          <Button onClick={() => strategyMut.mutate(true)} disabled={!strategyId}>
            정지 ON
          </Button>
          <Button
            variant="ghost"
            onClick={() => strategyMut.mutate(false)}
            disabled={!strategyId || !tokenHash}
          >
            해제
          </Button>
        </div>
      </div>
    </Card>
  )
}
