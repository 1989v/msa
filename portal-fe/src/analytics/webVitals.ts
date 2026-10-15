import type { Metric } from 'web-vitals';
import { PUBLIC_GAME_SLUGS } from '../seo/publicGameSlugs.mjs';
import { webVitalsDocument } from './webVitalsDocument';

type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

/** Public documents only. Never classify a room, invite, account or unknown path as a detail. */
function publicDocument(url: URL): { pageType: string; lang: 'ko' | 'en' } | null {
  if (url.protocol !== 'https:' || url.search || url.hash) return null;
  const lang = url.pathname === '/en' || url.pathname.startsWith('/en/') ? 'en' : 'ko';
  const path = lang === 'en' ? url.pathname.slice(3) || '/' : url.pathname;
  if (url.host === 'game.1989v.com') {
    if (path === '/') return { pageType: 'game_hub', lang };
    if (path === '/draw') return { pageType: 'game_draw', lang };
    if (/^\/games\/genre\/(arcade|action|puzzle|rpg|strategy|defense|versus|casual|decider)$/.test(path)) return { pageType: 'game_genre', lang };
    const slug = /^\/games\/([a-z0-9-]+)$/.exec(path)?.[1];
    if (slug && PUBLIC_GAME_SLUGS.has(slug)) return { pageType: 'game_detail', lang };
  }
  if (url.host === 'place.1989v.com') {
    if (path === '/') return { pageType: 'place_hub', lang };
    if (/^\/attractions\/\d+$/.test(path)) return { pageType: 'place_detail', lang };
    if (/^\/regions\/\d{2}(?:\d{3})?$/.test(path)) return { pageType: 'place_region', lang };
    if (lang === 'ko' && /^\/guides(?:\/(seoul-free-indoor|seoul-palaces-half-day))?$/.test(path)) return { pageType: 'place_guide', lang };
  }
  return null;
}

function privateReferrer(referrer: string): boolean {
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    return url.hostname.split('.')[0] === 'resume' || !!url.search || !!url.hash ||
      /(?:^|\/)(shared|party|login|account|admin|auth|profile|favorites)(?:\/|$)/i.test(url.pathname);
  } catch { return true; }
}

/**
 * Standard, document-scoped CWV, not SPA-route or iframe game performance.
 * Called after boot; buffered observers allow the official library to load late.
 * https://github.com/GoogleChrome/web-vitals#usage
 * https://developers.google.com/analytics/devguides/collection/ga4/events
 */
export async function installWebVitals(initialHref: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const target = window as AnalyticsWindow;
  const state = webVitalsDocument();
  if (!state || state.installed) return;
  state.installed = true;
  try {
    const initial = new URL(initialHref);
    const context = publicDocument(initial);
    if (!context || privateReferrer(document.referrer) || typeof target.gtag !== 'function' || !('PerformanceObserver' in window)) return;
    const stillPublic = () => !state.stopped && state.initialHref === initialHref && window.location.href === initial.href && publicDocument(new URL(window.location.href)) !== null &&
      !privateReferrer(document.referrer) && typeof target.gtag === 'function';
    if (!stillPublic()) return;
    const { onCLS, onINP, onLCP } = await import('web-vitals');
    if (!stillPublic()) return;
    const report = (metric: Metric) => {
      try {
        if (!stillPublic() || !['CLS', 'INP', 'LCP'].includes(metric.name) || !Number.isFinite(metric.value) ||
          !Number.isFinite(metric.delta) || !['good', 'needs-improvement', 'poor'].includes(metric.rating)) return;
        target.gtag?.('event', 'web_vitals', {
          metric_name: metric.name,
          metric_value: metric.value,
          metric_delta: metric.delta,
          metric_rating: metric.rating,
          page_type: context.pageType,
          page_lang: context.lang,
          non_interaction: true,
          // Override GA defaults; no detail ids, URL parameters, names or referrers.
          page_location: `${initial.origin}/${context.pageType}`,
          page_referrer: '',
          page_title: context.pageType,
        });
      } catch { /* Analytics must never interrupt the page. */ }
    };
    onCLS(report);
    onINP(report);
    onLCP(report);
  } catch { /* Blocked chunks and unsupported browsers leave the application usable. */ }
}
