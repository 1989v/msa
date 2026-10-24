import { useState } from 'react';
import { cafeDrinkImage } from './cafeDrinkImages';

export function cafeCupTone(name: string, group = ''): 'coffee' | 'fruit' | 'tea' | 'cream' | 'yellow' {
  if (/딸기|베리|자몽/.test(name)) return 'fruit';
  if (/말차|녹차/.test(name)) return 'tea';
  if (/망고|레몬/.test(name) || /에이드|주스/.test(group || name)) return 'yellow';
  if (/스무디|프라페/.test(group || name)) return 'fruit';
  if (/라떼|고구마|바닐라/.test(group + name)) return 'cream';
  return 'coffee';
}
/** Local SVG fallback when a generated decorative image cannot load. */
function CafeCupFallback({ name = '', group = '' }: { name?: string; group?: string }) {
  const type = cafeCupTone(name, group);
  const whipped = /라떼|스무디|프라페/.test(name + group);
  return <svg className={`cafe-cup cafe-cup--${type}`} viewBox="0 0 100 140" fill="none" aria-hidden="true">
    <ellipse cx="50" cy="130" rx="30" ry="5" className="cafe-art-shadow" />
    <path d="M25 43H75L69 120Q68 128 59 129H41Q32 128 31 120Z" className="cafe-art-glass" />
    <path d="M29 54H71L66 119Q65 124 58 125H42Q35 124 34 119Z" className="cafe-art-drink" />
    <path d="M32 60Q50 69 69 61L68 79Q47 88 33 76Z" className="cafe-art-milk" />
    {[0, 1, 2, 3].map(i => <rect key={i} x={35 + (i % 2) * 19} y={58 + Math.floor(i / 2) * 19} width="13" height="12" rx="3" transform={`rotate(${i % 2 ? 15 : -12} ${41 + (i % 2) * 19} ${64 + Math.floor(i / 2) * 19})`} className="cafe-art-ice" />)}
    <path d="M38 55L42 116" strokeWidth="4" strokeLinecap="round" className="cafe-art-highlight" />
    <path d="M62 45L68 13" strokeWidth="4" strokeLinecap="round" className="cafe-art-straw" />
    {whipped && <><path d="M25 43Q24 35 35 32Q29 25 42 23Q37 17 50 14Q55 9 51 5Q68 15 61 23Q74 24 68 33Q80 36 74 44Z" className="cafe-art-cream" /><path d="M36 34Q49 39 65 31M40 24Q52 29 61 23M47 16L54 19" className="cafe-art-topping" strokeWidth="3" strokeLinecap="round" /></>}
    <ellipse cx="50" cy="45" rx="26" ry="5" className="cafe-art-rim" />
    <path d="M25 46L31 120Q32 128 41 129H59Q68 128 69 120L75 46" className="cafe-art-outline" strokeWidth="1.5" />
  </svg>;
}
/** Generated recipe illustration, decorative alongside the menu's text label. */
export function CafeCup({ name = '', group = '', eager = false }: { name?: string; group?: string; eager?: boolean }) {
  const src = cafeDrinkImage(name, group);
  const [failedSrc, setFailedSrc] = useState<string>();
  return failedSrc === src ? <CafeCupFallback name={name} group={group} /> : <img
    className="cafe-cup cafe-drink-image" src={src} width={512} height={512}
    alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'} decoding="async"
    onError={() => setFailedSrc(src)}
  />;
}

const brandTones: Record<string, string> = { starbucks: 'green', mega: 'yellow', 'mega-mgc': 'yellow', megacoffee: 'yellow', compose: 'blue', 'compose-coffee': 'blue', theventi: 'purple', 'the-venti': 'purple', ediya: 'blue', paik: 'brown', 'paiks-coffee': 'brown' };
/** Official icons taken from each brand's own site (sources: docs/architecture/data-sources.md). Symbol marks fill the circle; wordmarks get an inset. */
const brandLogos: Record<string, 'fill' | 'inset'> = { compose: 'fill', paik: 'fill', starbucks: 'fill', twosome: 'fill', dunkin: 'inset', ediya: 'inset', mega: 'inset', parisbaguette: 'inset', theventi: 'inset', gongcha: 'inset', paulbassett: 'inset', hollys: 'inset', pascucci: 'inset', uzi: 'fill', mammoth: 'inset' };
export function CafeBrandBadge({ slug, name }: { slug: string; name: string }) {
  const logo = brandLogos[slug];
  if (logo) return <span className={`cafe-brand-badge cafe-brand-badge--logo cafe-brand-badge--${logo}`} aria-hidden="true"><img src={`/cafe/brands/${slug}.png`} alt="" width={96} height={96} loading="lazy" decoding="async" /></span>;
  return <span className={`cafe-brand-badge cafe-brand-badge--${brandTones[slug] ?? 'teal'}`} aria-hidden="true">{name.slice(0, 1)}</span>;
}
export function CafeIcon({ kind }: { kind: 'search' | 'back' | 'share' | 'filter' | 'cup' }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'search' ? <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></> : kind === 'back' ? <path d="m14 5-7 7 7 7" /> : kind === 'share' ? <><path d="M12 15V2m-4 4 4-4 4 4M6 9H4v13h16V9h-2" /></> : kind === 'filter' ? <path d="M4 6h16M4 12h12M4 18h8" /> : <><path d="M6 7h12l-2 15H8L6 7ZM5 7h14M14 7l2-6" /><circle cx="12" cy="13" r="2" /></>}</svg>;
}

/** Decorative condition art: three stacked cubes, a coffee bean, and a layered flame. */
export function CafeConditionIcon({ kind }: { kind: 'sugar' | 'caffeine' | 'kcal' }) {
  return <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    {kind === 'sugar' ? <>{[[7, 24], [25, 24], [16, 8]].map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`}>
      <path d="M0 5 8 0 16 5 8 10Z" fill="var(--cafe-icon-sugar-top)" />
      <path d="M0 5 8 10V21L0 16Z" fill="var(--cafe-icon-sugar-front)" />
      <path d="M8 10 16 5V16L8 21Z" fill="var(--cafe-icon-sugar-side)" />
    </g>)}</> : kind === 'caffeine' ? <g transform="rotate(35 24 24)">
      <ellipse cx="24" cy="24" rx="14" ry="20" fill="var(--cafe-art-coffee)" />
      <path d="M24 5C9 16 33 29 24 43C40 34 17 18 24 5Z" fill="var(--cafe-art-topping)" />
      <path d="M25 6C13 19 34 28 24 42" stroke="var(--cafe-art-milk)" strokeWidth="1.5" strokeLinecap="round" />
    </g> : <>
      <path d="M24 3C28 13 39 15 36 25C40 23 41 20 40 18C49 33 38 45 25 45C10 45 3 34 9 23C10 28 13 29 14 25C14 16 23 12 24 3Z" fill="var(--cafe-icon-flame-outer)" />
      <path d="M25 17C27 25 36 29 33 37C31 44 20 46 15 38C11 31 19 26 19 22C20 28 24 28 25 17Z" fill="var(--cafe-icon-flame-inner)" />
    </>}
  </svg>;
}
