import '@kgd/design-system/tokens.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// quant-fe 는 다크 테마 (샘플 디자인 매칭). prefers-color-scheme 영향 차단.
document.documentElement.dataset.theme = 'dark';

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
