import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Dialog } from './dialog';

afterEach(cleanup);
it('handles Escape only for the topmost open dialog and cleans up when unmounted', () => {
  const first = vi.fn(), second = vi.fn();
  const { rerender, unmount } = render(<><Dialog open title="first" onClose={first}>first</Dialog><Dialog open title="second" onClose={second}>second</Dialog></>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(second).toHaveBeenCalledTimes(1); expect(first).not.toHaveBeenCalled();
  rerender(<Dialog open title="first" onClose={first}>first</Dialog>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(first).toHaveBeenCalledTimes(1);
  unmount(); fireEvent.keyDown(document, { key: 'Escape' });
  expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1);
});
