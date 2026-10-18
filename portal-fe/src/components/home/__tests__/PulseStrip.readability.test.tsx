import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('../../../api/gameApi', () => ({ listGames: vi.fn(async () => ({ totalElements: 82 })) }));
import PulseStrip from '../PulseStrip';
afterEach(() => vi.unstubAllGlobals());
it('shows actual loaded counts even if observers and animation frames never fire', async () => {
  vi.stubGlobal('IntersectionObserver', vi.fn());
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><PulseStrip openServices={8} openSourceCount={10} yearsInField={12} /></QueryClientProvider>);
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByText('8')).toBeInTheDocument();
  expect(await screen.findByText('82')).toBeInTheDocument();
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  expect(IntersectionObserver).not.toHaveBeenCalled();
});
it('keeps reveal content opaque while observers are pending', () => {
  const css = readFileSync('src/styles/kh-motion.css', 'utf8');
  for (const name of ['kh-seep', 'kh-settle', 'kh-stamp']) {
    expect(css).toMatch(new RegExp(`\\[data-reveal\\] \\.${name} \\{[^}]*opacity: 1;`));
  }
});
