import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { StrategyListPage } from '@/pages/StrategyListPage'
import { StrategyCreatePage } from '@/pages/StrategyCreatePage'
import { StrategyDetailPage } from '@/pages/StrategyDetailPage'
import { BacktestSubmitPage } from '@/pages/BacktestSubmitPage'
import { BacktestRunsPage } from '@/pages/BacktestRunsPage'
import { BacktestRunDetailPage } from '@/pages/BacktestRunDetailPage'
import { LeaderboardPage } from '@/pages/LeaderboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PaperTradingMonitorPage } from '@/pages/PaperTradingMonitorPage'
import { ChartsPage } from '@/pages/ChartsPage'
import { LearnPage } from '@/pages/LearnPage'
import { PortfolioDemoPage } from '@/pages/PortfolioDemoPage'
import { TrancheDemoPage } from '@/pages/TrancheDemoPage'
import { LearnDetailPage } from '@/pages/LearnDetailPage'
import { LiveTradingPage } from '@/pages/LiveTradingPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* basename = vite --base /quant/ 와 동기화. SPA 내부 링크가
          ingress prefix 를 자동 부여해 /quant/strategies/new 형태 생성. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route
            path="/"
            element={
              <AppShell>
                <HomePage />
              </AppShell>
            }
          />
          <Route
            path="/strategies"
            element={
              <AppShell>
                <StrategyListPage />
              </AppShell>
            }
          />
          <Route
            path="/strategies/new"
            element={
              <AppShell withTabBar={false}>
                <StrategyCreatePage />
              </AppShell>
            }
          />
          <Route
            path="/strategies/:id"
            element={
              <AppShell>
                <StrategyDetailPage />
              </AppShell>
            }
          />
          <Route
            path="/strategies/:id/backtests/new"
            element={
              <AppShell withTabBar={false}>
                <BacktestSubmitPage />
              </AppShell>
            }
          />
          <Route
            path="/strategies/:id/paper/monitor"
            element={
              <AppShell withTabBar={false}>
                <PaperTradingMonitorPage />
              </AppShell>
            }
          />
          <Route
            path="/strategies/:id/runs"
            element={<Navigate to="../" replace />}
          />
          <Route
            path="/runs"
            element={
              <AppShell>
                <BacktestRunsPage />
              </AppShell>
            }
          />
          <Route
            path="/runs/:runId"
            element={
              <AppShell withTabBar={false}>
                <BacktestRunDetailPage />
              </AppShell>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <AppShell>
                <LeaderboardPage />
              </AppShell>
            }
          />
          <Route
            path="/charts"
            element={
              <AppShell>
                <ChartsPage />
              </AppShell>
            }
          />
          <Route
            path="/learn"
            element={
              <AppShell>
                <LearnPage />
              </AppShell>
            }
          />
          <Route
            path="/learn/:slug"
            element={
              <AppShell>
                <LearnDetailPage />
              </AppShell>
            }
          />
          <Route
            path="/live-trading"
            element={
              <AppShell withTabBar={false}>
                <LiveTradingPage />
              </AppShell>
            }
          />
          <Route
            path="/settings"
            element={
              <AppShell withTabBar={false}>
                <SettingsPage />
              </AppShell>
            }
          />
          {/* === @kgd/design-system showcase pages (샘플 1/2 정확 매칭) === */}
          <Route
            path="/portfolio-demo"
            element={
              <AppShell withTabBar={false}>
                <PortfolioDemoPage />
              </AppShell>
            }
          />
          <Route
            path="/tranche-demo"
            element={
              <AppShell withTabBar={false}>
                <TrancheDemoPage />
              </AppShell>
            }
          />
          <Route
            path="*"
            element={
              <AppShell withTabBar={false}>
                <NotFoundPage />
              </AppShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
