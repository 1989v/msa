import type { CafeDrink } from '../../api/rankingApi';
const LABELS: Record<string, string> = { displayName: '표시명', drinkGroup: '유형', volumeMl: '용량', kcal: '열량', sugarG: '당류', caffeineMg: '카페인', sodiumMg: '나트륨', carbsG: '탄수화물', fatG: '지방', satFatG: '포화지방', proteinG: '단백질', sourceUrl: '출처 링크', checkedAt: '확인일' };
/** Official source and operator correction evidence are distinct statements. */
export function CafeSources({ drink }: { drink: Pick<CafeDrink, 'sourceUrl' | 'checkedAt' | 'officialSourceUrl' | 'officialCheckedAt' | 'correctionEvidence'> }) {
  return <div className="cafe-sources"><p><a href={drink.officialSourceUrl ?? drink.sourceUrl} target="_blank" rel="noopener noreferrer">공식 영양정보 원문 ↗</a> · 원천 확인일 {drink.officialCheckedAt ?? drink.checkedAt}</p>{Object.entries(drink.correctionEvidence ?? {}).map(([field, evidence]) => <p key={field}>{LABELS[field] ?? '정보'} 교정 근거: <a href={evidence.evidenceUrl} target="_blank" rel="noopener noreferrer">공식 자료 ↗</a> · {evidence.evidenceCheckedAt} · {evidence.reason}</p>)}</div>;
}
