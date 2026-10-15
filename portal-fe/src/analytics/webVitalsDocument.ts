export type WebVitalsWindow = Window & {
  __kgdWebVitals?: { initialHref: string; installed: boolean; stopped: boolean };
};

export function webVitalsDocument() {
  if (typeof window === 'undefined') return null;
  const target = window as WebVitalsWindow;
  return target.__kgdWebVitals ??= { initialHref: window.location.href, installed: false, stopped: false };
}

// Snapshot before React effects and deferred measurement chunks.
webVitalsDocument();
