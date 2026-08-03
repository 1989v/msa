import '@kgd/design-system/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { queryClient } from './shell/queryClient';
import { AuthProvider } from './shell/AuthContext';

// portal-fe 는 dark theme — prefers-color-scheme 영향 차단을 위해 명시.
document.documentElement.dataset.theme = 'dark';

// ADR-0058 R3 FE 통합 — 통합 셸 provider: QueryClient + Auth (흡수될 sub-app 공유).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
