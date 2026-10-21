import type { Drink, DrinkDetail, FieldChange } from '@/api/ranking';
export const NUMERIC_FIELDS = ['volumeMl', 'kcal', 'sugarG', 'caffeineMg', 'sodiumMg', 'carbsG', 'fatG', 'satFatG', 'proteinG'];
/** Draft-only preview. RESET reads current derived values; UNKNOWN never coalesces to source. */
export function draftProjection(row: DrinkDetail, fields: Record<string, FieldChange>): Drink | null {
  if (!row.effective || !row.derived) return null;
  const result = { ...row.effective };
  const number = (value: string | null | undefined) => value == null || value.trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  for (const [field, change] of Object.entries(fields)) {
    if (field === 'volumeMl') {
      result.cupVolumeMl = change.action === 'RESET' ? row.derived.cupVolumeMl : change.action === 'SET_UNKNOWN' ? null : number(change.value);
      result.volumeSource = change.action === 'RESET' ? row.derived.volumeSource : change.action === 'SET_UNKNOWN' ? 'NONE' : 'ADMIN_VERIFIED';
    } else if (NUMERIC_FIELDS.includes(field)) {
      const name = field as 'sugarG';
      result[name] = change.action === 'RESET' ? row.derived[name] : change.action === 'SET_UNKNOWN' ? null : number(change.value);
    } else if (field !== 'adminNote') {
      const name = (field === 'displayName' ? 'menuName' : field) as 'menuName';
      result[name] = change.action === 'RESET' ? row.derived[name] : change.value ?? '';
    }
  }
  const per100 = (value: number | null) => value === null || !Number.isFinite(value) || result.cupVolumeMl === null || !Number.isFinite(result.cupVolumeMl) || result.cupVolumeMl <= 0 ? null : Number((value * 100 / result.cupVolumeMl).toFixed(4));
  result.sugarPer100ml = per100(result.sugarG); result.caffeinePer100ml = per100(result.caffeineMg); result.kcalPer100ml = per100(result.kcal);
  return result;
}
