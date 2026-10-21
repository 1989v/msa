import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CafeSources } from '../CafeSources';

describe('official source and correction provenance', () => {
  it('labels original official source separately from corrected field evidence', () => {
    const drink = { sourceUrl: 'https://corrected.example/row', checkedAt: '2026-10-21', officialSourceUrl: 'https://official.example/original', officialCheckedAt: '2026-10-19', correctionEvidence: { sugarG: { evidenceUrl: 'https://evidence.example/table', evidenceCheckedAt: '2026-10-20', reason: '표 판독 교정' } } };
    render(<CafeSources drink={drink} />);
    expect(screen.getByRole('link', { name: '공식 영양정보 원문 ↗' })).toHaveAttribute('href', 'https://official.example/original');
    expect(screen.getByRole('link', { name: '공식 자료 ↗' })).toHaveAttribute('href', 'https://evidence.example/table');
    expect(screen.getByText(/당류 교정 근거/)).toHaveTextContent('2026-10-20');
    expect(screen.getByText(/원천 확인일/)).toHaveTextContent('2026-10-19');
  });
});
