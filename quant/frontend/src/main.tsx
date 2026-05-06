import '@kgd/design-system/tokens.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// quant-fe 는 light theme — design-system 토큰을 light 변형으로 swap.
document.documentElement.dataset.theme = 'light';

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
