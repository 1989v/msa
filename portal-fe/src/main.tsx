import '@kgd/design-system/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// portal-fe 는 dark theme — prefers-color-scheme 영향 차단을 위해 명시.
document.documentElement.dataset.theme = 'dark';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
