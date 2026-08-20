import '@kgd/design-system/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
// 속성(`[data-surface='heritage']`)으로만 켜지므로 항상 로드해도 다른 화면에 영향 없다.
import './styles/k-heritage.css';
// 모션 문법 — `[data-reveal]`(useReveal 이 붙임)로만 켜진다. 문법 자체는 전 화면 공통.
import './styles/kh-motion.css';
// 앱 셸 — 탭바·시트·스켈레톤·스택 전환. 모바일(< 768px)에서만 개입한다.
import './styles/kh-shell.css';
import App from './App';
import { bootstrapTheme } from './hooks/useHeritageSurface';
import { queryClient } from './shell/queryClient';
import { AuthProvider } from './shell/AuthContext';

// 렌더 전에 톤을 정한다 — 훅은 effect 에서 돌아서, 여기서 칠하지 않으면
// 라이트를 고른 사람도 다크가 한 번 번쩍인 뒤 바뀐다.
bootstrapTheme(window.location.pathname);

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
