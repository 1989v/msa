// 백엔드 view DTO 미러.
// 직접 작성 — codegen 없음. 변경 시 백엔드 view 패키지와 sync 필요.

export interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

// === Strategy ===

export type StrategyStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'LIQUIDATED'
  | 'ARCHIVED'

export type ExecutionMode = 'BACKTEST' | 'PAPER' | 'LIVE'

export interface SplitStrategyConfigDto {
  /** 1~50 */
  roundCount: number
  /** 음수, 예: -3.0 */
  entryGapPercent: string // BigDecimal serialized as string
  /** 회차별 익절 % (배열 길이 = roundCount, 모두 양수) */
  takeProfitPercentPerRound: string[]
  /** 회차당 동일 매수 명목 금액 (KRW) */
  initialOrderAmount: string
  /** 거래쌍, 예: BTC_KRW / ETH_KRW */
  targetSymbol: string
}

export interface CreateStrategyRequest {
  config: SplitStrategyConfigDto
  /** Phase 1은 BACKTEST 만 사용 */
  executionMode?: ExecutionMode
}

export interface CreateStrategyResponse {
  strategyId: string
}

export interface StrategySummaryView {
  strategyId: string
  tenantId: string
  targetSymbol: string
  status: StrategyStatus
  executionMode: ExecutionMode
  roundCount: number
  createdAt: string // ISO-8601
  /** 백테스트 실행 횟수 (선택) */
  runCount?: number
}

export interface StrategyDetailView {
  strategyId: string
  tenantId: string
  status: StrategyStatus
  executionMode: ExecutionMode
  config: SplitStrategyConfigDto
  createdAt: string
  updatedAt: string
}

// === Backtest ===

export interface RunBacktestRequest {
  strategyId: string
  /** ISO-8601 instant */
  from: string
  to: string
  /** 결정론 시드 (선택) */
  seed?: number
}

export interface BacktestRunSummaryView {
  runId: string
  strategyId: string
  symbol: string
  fromTs: string
  toTs: string
  realizedPnl: string // BigDecimal
  mdd: string // 최대낙폭 비율 (음수 또는 양수 절대값)
  sharpe?: string
  fillCount: number
  startedAt: string
  endedAt: string
}

export interface BacktestFillView {
  /** 체결 순번 */
  sequence: number
  ts: string // ISO-8601
  roundIndex: number
  side: 'BUY' | 'SELL'
  price: string
  quantity: string
  /** 매도 시 회차별 실현 PnL (매수면 null) */
  pnl?: string | null
}

export interface BacktestRunResultView extends BacktestRunSummaryView {
  fills: BacktestFillView[]
  /** 회차별 누적 손익 (roundIndex 순) */
  pnlByRound?: Array<{ roundIndex: number; realizedPnl: string; fillCount: number }>
}

// === Dashboard ===

export interface DashboardOverview {
  tenantId: string
  totalStrategies: number
  totalBacktests: number
  /** 실현 PnL 누적 합 */
  cumulativeRealizedPnl: string
  /** 최근 fillCount 합 */
  totalFills: number
  /** 마지막 백테스트 종료 시각 */
  lastRunEndedAt?: string
}

// === Leaderboard ===

export interface LeaderboardEntry {
  rank: number
  runId: string
  strategyId: string
  symbol: string
  realizedPnl: string
  mdd: string
  fillCount: number
  endedAt: string
}
