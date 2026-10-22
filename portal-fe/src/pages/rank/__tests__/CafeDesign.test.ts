import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const css = readFileSync(resolve(__dirname, '../CafePage.css'), 'utf8');
const tokens = (source: string) => Object.fromEntries([...source.matchAll(/--cafe-([\w-]+):\s*(#[\da-fA-F]+)/g)].map(match => [match[1], match[2]]));
const base = tokens(css.split(":root[data-theme='dark']")[0]);
const dark = { ...base, ...tokens(css.split(":root[data-theme='dark']")[1].split('}\n')[0]) };
function luminance(color: string) { return [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255).reduce((total, value, index) => total + [0.2126, 0.7152, 0.0722][index] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4), 0); }
const pairs = [['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'soft'], ['on-cta', 'cta'], ['active-text', 'active'], ['sugar-text', 'sugar-bg'], ['caffeine-text', 'caffeine-bg'], ['kcal-text', 'kcal-bg'], ['banner-text', 'banner'], ['badge-text', 'badge-bg'], ...['green', 'blue', 'purple', 'brown', 'teal'].map(tone => ['brand-on-dark', `brand-${tone}`]), ['brand-on-yellow', 'brand-yellow']];
describe('cafe token guardrails', () => {
  it.each([['light', base], ['dark', dark]] as const)('%s text pairs meet WCAG 4.5:1', (_theme, palette) => {
    for (const [foreground, background] of pairs) {
      const values = [luminance(palette[foreground]), luminance(palette[background])].sort((a, b) => a - b);
      expect((values[1] + 0.05) / (values[0] + 0.05), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('confines literal colors to local token declarations and preserves 44px interaction targets', () => {
    expect(css.split('\n').filter(line => /#[\da-fA-F]{3,8}\b/.test(line) && !line.includes('--cafe-'))).toEqual([]);
    expect(css).toContain('.cafe-page button { min-width: 44px;');
    expect(css).toMatch(/\.cafe-page button, \.cafe-page summary, \.cafe-page select \{ min-height: 44px;/);
    expect(css).toContain('bottom: var(--kh-shell-bottom, 0px)');
  });
});
