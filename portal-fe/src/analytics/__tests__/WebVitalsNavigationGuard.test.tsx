import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter, Link } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import WebVitalsNavigationGuard from '../WebVitalsNavigationGuard';
import { webVitalsDocument, type WebVitalsWindow } from '../webVitalsDocument';

afterEach(() => { delete (window as WebVitalsWindow).__kgdWebVitals; history.replaceState({}, '', '/'); });

it('permanently stops document reporting on a route change including return navigation under StrictMode', () => {
  history.replaceState({}, '', '/');
  delete (window as WebVitalsWindow).__kgdWebVitals;
  render(<StrictMode><BrowserRouter><WebVitalsNavigationGuard /><Link to="/party/secret">Private</Link><Link to="/">Home</Link></BrowserRouter></StrictMode>);
  expect(webVitalsDocument()?.stopped).toBe(false);
  fireEvent.click(screen.getByText('Private'));
  expect(webVitalsDocument()?.stopped).toBe(true);
  fireEvent.click(screen.getByText('Home'));
  expect(webVitalsDocument()?.stopped).toBe(true);
});
