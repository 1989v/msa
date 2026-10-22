import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { cafeCategories } from '../cafeCategories';

it('assigns every backend-allowed recipe group exactly once, including newly added groups', () => {
  // This is the backend admin correction validator's authoritative allowed group list.
  const source = readFileSync(resolve(__dirname, '../../../../../ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/CafeCorrectionProjection.kt'), 'utf8');
  const declaration = source.match(/val groups = listOf\(([^)]*)\)/)?.[1];
  expect(declaration, 'backend group declaration must remain discoverable').toBeDefined();
  const groups = [...declaration!.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  expect(groups.length).toBeGreaterThan(0);
  const assigned = cafeCategories.filter(category => !['all', 'decaf'].includes(category.slug)).flatMap(category => [category.filters.group ?? []].flat());
  expect(assigned.sort()).toEqual(groups.sort());
  expect(new Set(assigned).size).toBe(assigned.length);
  expect(cafeCategories.find(category => category.slug === 'all')?.filters).toEqual({});
  expect(cafeCategories.find(category => category.slug === 'decaf')?.filters).toEqual({ caffeine: 'decaf' });
});
