import { render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNearViewport } from '../useNearViewport';
afterEach(() => vi.unstubAllGlobals());
function Section() { const [ref, ready] = useNearViewport(); return <section ref={ref}>{ready ? 'ready' : 'deferred'}</section>; }
it('defers data eligibility until approaching the section and disconnects on entry', () => {
  let deliver!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  const observe = vi.fn();
  const constructor = vi.fn(function (callback: IntersectionObserverCallback) { deliver = callback; return { observe, disconnect }; });
  vi.stubGlobal('IntersectionObserver', constructor);
  const view = render(<Section />);
  expect(screen.getByText('deferred')).toBeInTheDocument();
  expect(constructor).toHaveBeenCalledWith(expect.any(Function), { rootMargin: '320px', threshold: 0 });
  act(() => deliver([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver));
  expect(screen.getByText('deferred')).toBeInTheDocument();
  act(() => deliver([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
  expect(screen.getByText('ready')).toBeInTheDocument();
  expect(disconnect).toHaveBeenCalledOnce();
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(2);
});
it('loads normally where IntersectionObserver is unavailable', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  render(<Section />);
  expect(screen.getByText('ready')).toBeInTheDocument();
});
