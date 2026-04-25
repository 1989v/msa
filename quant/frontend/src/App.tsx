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
      <BrowserRouter>
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
            path="/settings"
            element={
              <AppShell withTabBar={false}>
                <SettingsPage />
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
