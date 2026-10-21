import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { RankingPage } from '../RankingPage';
import * as api from '@/api/ranking';
import type { Drink, DrinkDetail, Operation, Brand, Conflict } from '@/api/ranking';
vi.mock('@/api/ranking', async () => ({ ...await vi.importActual<typeof api>('@/api/ranking'), rankingGet: vi.fn(), rankingWrite: vi.fn() }));
const row = (id: number): DrinkDetail => {
  const drink: Drink = { brandSlug: 'a', brandName: '브랜드A', menuName: `원천메뉴${id}`, displayName: null, sourceCategory: '음료', temperature: 'ICE', sizeLabel: 'R', caffeineStatus: 'DISCLOSED', volumeMl: 400, servingBasis: '400ml', cupVolumeMl: 400, volumeSource: 'ROW', kcal: 100, sugarG: 10, caffeineMg: 20, sodiumMg: 1, carbsG: 1, fatG: 1, satFatG: 1, proteinG: 1, sourceUrl: 'https://official.example/menu', checkedAt: '2026-10-20', notes: '<b>원문 보존</b>', rawNutrition: { '당류': '10g' }, drinkGroup: '기타', drinkKey: `key${id}`, sugarPer100ml: 2.5, caffeinePer100ml: 5, kcalPer100ml: 25 };
  return { drinkKey: `key${id}`, source: drink, derived: drink, effective: drink, override: {}, adminNote: null, revision: 2, generation: 3 };
};
const op = (id = 'saved'): Operation => ({ operationId: id, actorId: 27, at: '2026-10-21T01:00:00Z', changed: 1, auditIds: ['audit'], revisions: { key1: 3 }, generations: { key1: 3 } });
function view(path: string) { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/ranking/*" element={<RankingPage />} /></Routes></MemoryRouter>); }
beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(api.rankingGet).mockImplementation(async (path, params) => {
    if (path === 'cafe/groups') return { allowedGroups: ['기타', '티'], items: [{ group: '기타', derivedCount: 157, effectiveCount: 157, correctedCount: 0, conflictCount: 0 }] } as never;
    if (path === 'cafe/drinks') { const page = Number(params?.get('page') ?? 0); const size = Number(params?.get('size') ?? 50); return { items: Array.from({ length: Math.min(size, 157 - page * size) }, (_, i) => row(page * size + i + 1)), total: 157, page, size } as never; }
    if (path.startsWith('cafe/drinks/')) return row(1) as never;
    return { items: [], total: 0, page: 0, size: 50 } as never;
  });
  vi.mocked(api.rankingWrite).mockResolvedValue(op());
});
function fillEvidence() {
  fireEvent.change(screen.getByLabelText('사유*'), { target: { value: '공식 대조' } });
  fireEvent.change(screen.getByLabelText('근거 URL*'), { target: { value: 'https://official.example/menu' } });
  fireEvent.change(screen.getByLabelText('확인일*'), { target: { value: '2026-10-20' } });
}
const brandFixture = (): Brand => ({ brandSlug: 'a', brandName: '민감 브랜드', count: 1, sourceUrls: ['https://official.example/menu'], minCheckedAt: '2026-10-20', maxCheckedAt: '2026-10-20', unknownVolumeCount: 0, rights: '미확인', verification: { brandSlug: 'a', revision: 1, generation: 2, officialUrls: ['https://old.example/menu'], verifiedAt: '2026-10-20', verificationNote: '원래 메모' } });
const conflictFixture = (): Conflict => ({ id: 'conflict', drinkKey: 'key1', brandSlug: 'a', field: 'sugarG', state: 'CONFLICT', correction: { action: 'SET', value: '10', baseline: 'old', state: 'CONFLICT', evidenceUrl: 'https://evidence.example/menu', evidenceCheckedAt: '2026-10-19', correctionReason: '이전 대조', dependencies: { sourceValue: '20', servingBasis: '400ml' }, sourceSnapshot: row(1).source }, currentSource: '15', currentEffective: '15', revision: 3, generation: 4, sourceSnapshot: row(1).source, currentSourceSnapshot: row(1).source, baselineDependencies: { sourceValue: '20', servingBasis: '400ml' }, currentDependencies: { sourceValue: '15', servingBasis: '500ml' } });
describe('Ranking admin P1', () => {
  it('keeps explicit keys across four pages and previews exactly 157 reviewed rows', async () => {
    view('/ranking/cafe/drinks');
    await screen.findByText('브랜드A / 원천메뉴1');
    for (let page = 0; page < 4; page++) {
      fireEvent.click(screen.getByRole('button', { name: '현재 페이지 선택' }));
      if (page < 3) { fireEvent.click(screen.getByRole('button', { name: '다음' })); await screen.findByText(`브랜드A / 원천메뉴${(page + 1) * 50 + 1}`); }
    }
    expect(screen.getByText('선택 157/200행')).toBeInTheDocument();
    fireEvent.click(screen.getByText('선택 유형 일괄 교정'));
    await screen.findByText('유형 일괄 교정 / 선택 157행');
    fireEvent.change(screen.getByLabelText('변경할 유형'), { target: { value: '티' } });
    fireEvent.change(screen.getByLabelText('사유*'), { target: { value: '동일 공식 기준 대조' } });
    fireEvent.change(screen.getByLabelText('근거 URL*'), { target: { value: 'https://official.example/menu' } });
    fireEvent.change(screen.getByLabelText('확인일*'), { target: { value: '2026-10-20' } });
    vi.mocked(api.rankingWrite).mockResolvedValueOnce({ previewToken: 'preview', expiresAt: '2099-01-01T00:00:00Z', changed: Array.from({ length: 157 }, (_, i) => `key${i + 1}`), unchanged: [], blocked: [] });
    fireEvent.click(screen.getByRole('button', { name: '미리보기 생성' }));
    await screen.findByRole('button', { name: '157행 교정 반영' });
    const payload = vi.mocked(api.rankingWrite).mock.calls[0][2] as { keys: string[] };
    expect(payload.keys).toHaveLength(157); expect(new Set(payload.keys).size).toBe(157);
  });
  it('compares immutable source and effective values and sends only changed field tri-state', async () => {
    const { container } = view('/ranking/cafe/drinks/key1');
    await screen.findByText('브랜드A / 원천메뉴1');
    expect(container.querySelector('b')).toBeNull();
    fireEvent.change(screen.getByLabelText('용량(ml) 처리'), { target: { value: 'SET_UNKNOWN' } });
    fireEvent.change(screen.getByLabelText('사유*'), { target: { value: '공식 용량 미확정' } });
    fireEvent.change(screen.getByLabelText('근거 URL*'), { target: { value: 'https://official.example/menu' } });
    fireEvent.change(screen.getByLabelText('확인일*'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByRole('button', { name: '교정 저장' }));
    await waitFor(() => expect(api.rankingWrite).toHaveBeenCalled());
    const payload = vi.mocked(api.rankingWrite).mock.calls[0][2] as Record<string, unknown>;
    expect(payload.fields).toEqual({ volumeMl: { action: 'SET_UNKNOWN', value: null } });
    expect(payload.expectedRevision).toBe(2); expect(payload.sourceGeneration).toBe(3);
    expect(payload).not.toHaveProperty('rawNutrition'); expect(payload).not.toHaveProperty('actorId');
  });
  it('preserves draft on 409 without showing a success', async () => {
    vi.mocked(api.rankingWrite).mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
    view('/ranking/cafe/drinks/key1'); await screen.findByText('브랜드A / 원천메뉴1');
    fireEvent.change(screen.getByLabelText('표시명 처리'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByLabelText('표시명 새 값'), { target: { value: '수정 초안' } });
    fireEvent.change(screen.getByLabelText('사유*'), { target: { value: '교정' } });
    fireEvent.change(screen.getByLabelText('근거 URL*'), { target: { value: 'https://official.example/menu' } });
    fireEvent.change(screen.getByLabelText('확인일*'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByRole('button', { name: '교정 저장' }));
    await screen.findByText(/다른 수정 또는 새 적재가 반영/);
    expect(screen.getByLabelText('표시명 새 값')).toHaveValue('수정 초안');
    expect(screen.queryByText('감사·되돌리기 검토')).not.toBeInTheDocument();
  });
  it('recovers response loss using the exact pre-generated operation UUID before offering retry', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const { useOperation } = await import('../shared');
    vi.mocked(api.rankingWrite).mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce(op());
    vi.mocked(api.rankingGet).mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
    const callback = vi.fn(); const hook = renderHook(() => useOperation(callback));
    await act(async () => { await hook.result.current.submit('patch', 'cafe/drinks/key1/corrections', { expectedRevision: 2, sourceGeneration: 3 }); });
    expect(hook.result.current.unknown).toBe(true);
    const first = vi.mocked(api.rankingWrite).mock.calls[0];
    expect(api.rankingGet).toHaveBeenCalledWith(`operations/${(first[2] as { idempotencyKey: string }).idempotencyKey}`);
    await act(async () => { await hook.result.current.retry(); });
    expect(vi.mocked(api.rankingWrite).mock.calls[1]).toEqual(first);
    expect(callback).toHaveBeenCalledTimes(1);
  });
  it('read-only gas page explains TOP20 and renders no ingest, price or rank write controls', async () => {
    view('/ranking/gas'); await screen.findByText(/전국 전량이 아닌/);
    await waitFor(() => expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /저장|재생성|삭제|재수집/ })).not.toBeInTheDocument();
    expect(api.rankingWrite).not.toHaveBeenCalled();
  });
  it('shows 403 separately from an empty result and removes correction actions', async () => {
    vi.mocked(api.rankingGet).mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
    view('/ranking/cafe/drinks/key1');
    await screen.findByText(/관리자 권한이 필요합니다/);
    expect(screen.queryByRole('button', { name: '교정 저장' })).not.toBeInTheDocument();
    expect(screen.queryByText(/조건에 맞는 데이터 없음/)).not.toBeInTheDocument();
  });
});


describe('round 1 reviewed UI contracts', () => {
  it('F6/F13 submits search once, clears selection on filter/sort change and fetches all-filtered keys from server', async () => {
    view('/ranking/cafe/drinks'); await screen.findByText('브랜드A / 원천메뉴1');
    fireEvent.click(screen.getByRole('button', { name: '현재 페이지 선택' }));
    expect(screen.getByText('선택 50/200행')).toBeInTheDocument();
    const before = vi.mocked(api.rankingGet).mock.calls.length;
    fireEvent.change(screen.getByLabelText('메뉴명·표시명'), { target: { value: '티' } });
    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'sugar' } });
    expect(vi.mocked(api.rankingGet).mock.calls.length).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: '검색·필터 적용' }));
    await waitFor(() => expect(screen.getByText('선택 0/200행')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: '필터 결과 157행 선택' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: '필터 결과 157행 선택' }));
    await screen.findByText('선택 157/200행');
    const last = vi.mocked(api.rankingGet).mock.calls.filter(([path]) => path === 'cafe/drinks').at(-1)!;
    expect(last[1]?.get('q')).toBe('티'); expect(last[1]?.get('sort')).toBe('sugar'); expect(last[1]?.get('size')).toBe('200');
    fireEvent.change(screen.getByLabelText('페이지 크기'), { target: { value: '100' } });
    await waitFor(() => expect(vi.mocked(api.rankingGet).mock.calls.at(-1)?.[1]?.get('size')).toBe('100'));
  });
  it('F5 reloads latest detail revision while retaining draft and requires explicit re-submit', async () => {
    const base = vi.mocked(api.rankingGet).getMockImplementation()!; let current = row(1);
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path === 'cafe/drinks/key1' ? Promise.resolve(current) as never : base(path, params));
    vi.mocked(api.rankingWrite).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } }).mockResolvedValueOnce(op());
    view('/ranking/cafe/drinks/key1'); await screen.findByText('브랜드A / 원천메뉴1');
    fireEvent.change(screen.getByLabelText('표시명 처리'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByLabelText('표시명 새 값'), { target: { value: '유지할 초안' } }); fillEvidence();
    fireEvent.click(screen.getByRole('button', { name: '교정 저장' }));
    await screen.findByRole('button', { name: '최신 기준 다시 조회 — 초안 유지' });
    expect(screen.getByRole('button', { name: '교정 저장' })).toBeDisabled();
    current = { ...current, revision: 8, generation: 9 };
    fireEvent.click(screen.getByRole('button', { name: '최신 기준 다시 조회 — 초안 유지' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '교정 저장' })).not.toBeDisabled());
    expect(screen.getByLabelText('표시명 새 값')).toHaveValue('유지할 초안'); expect(api.rankingWrite).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '교정 저장' }));
    await waitFor(() => expect(api.rankingWrite).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.rankingWrite).mock.calls[1][2]).toMatchObject({ expectedRevision: 8, sourceGeneration: 9 });
  });
  it('F4/F14 previews nullable nutrients and cup/source/per100ml before saving', async () => {
    view('/ranking/cafe/drinks/key1'); await screen.findByText('브랜드A / 원천메뉴1');
    fireEvent.change(screen.getByLabelText('당류(g) 처리'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByLabelText('당류(g) 새 값'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('용량(ml) 처리'), { target: { value: 'SET' } });
    expect(screen.getByLabelText('변경 미리보기')).toHaveTextContent('유효 컵용량 미확정ml');
    fireEvent.change(screen.getByLabelText('용량(ml) 새 값'), { target: { value: '500' } });
    expect(screen.getByLabelText('변경 미리보기')).toHaveTextContent('100ml당 당류 4g');
    expect(screen.getByLabelText('변경 미리보기')).toHaveTextContent('500ml / ADMIN_VERIFIED');
    fireEvent.change(screen.getByLabelText('용량(ml) 처리'), { target: { value: 'SET_UNKNOWN' } });
    expect(screen.getByLabelText('변경 미리보기')).toHaveTextContent('100ml당 당류 미확정g');
    fireEvent.change(screen.getByLabelText('용량(ml) 처리'), { target: { value: 'RESET' } });
    expect(screen.getByLabelText('변경 미리보기')).toHaveTextContent('400ml / ROW');
    fireEvent.change(screen.getByLabelText('당류(g) 처리'), { target: { value: 'SET_UNKNOWN' } });
    expect(screen.getByLabelText('변경 미리보기')).toHaveTextContent('100ml당 당류 미확정g');
    expect(api.rankingWrite).not.toHaveBeenCalled();
  });
  it('F15 shows server field400 inline and focuses the invalid draft input', async () => {
    vi.mocked(api.rankingWrite).mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: { error: { code: 'INVALID_FIELD_sugarG', message: '0 이상 값을 입력하세요' } } } });
    view('/ranking/cafe/drinks/key1'); await screen.findByText('브랜드A / 원천메뉴1');
    fireEvent.change(screen.getByLabelText('당류(g) 처리'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByLabelText('당류(g) 새 값'), { target: { value: '-1' } }); fillEvidence();
    fireEvent.click(screen.getByRole('button', { name: '교정 저장' }));
    await waitFor(() => expect(screen.getAllByText('0 이상 값을 입력하세요').length).toBeGreaterThan(0));
    expect(screen.getByLabelText('당류(g) 새 값')).toHaveFocus();
    expect(screen.getByLabelText('당류(g) 새 값')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('당류(g) 새 값')).toHaveValue('-1');
  });
  it('F15 guards programmatic history and replace navigation, tab close and dirty brand URLs before reason entry', async () => {
    const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path === 'cafe/brands' ? Promise.resolve({ items: [brandFixture()], total: 1, page: 0, size: 50 }) as never : base(path, params));
    function Controls() { const navigate = useNavigate(); return <><button onClick={() => navigate(-1)}>기록 뒤로</button><button onClick={() => navigate('/other', { replace: true })}>프로그램 이동</button></>; }
    render(<MemoryRouter initialEntries={['/ranking/cafe/drinks', '/ranking/cafe/brands']}><Controls /><Routes><Route path="/ranking/*" element={<RankingPage />} /><Route path="/other" element={<p>다른 화면</p>} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: '민감 브랜드' }));
    fireEvent.change(screen.getByLabelText('공식 URL 1'), { target: { value: 'https://draft.example/menu' } });
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByText('기록 뒤로')); await screen.findByRole('dialog', { name: '미저장 변경' });
    fireEvent.click(screen.getByText('편집 계속')); expect(screen.getByLabelText('공식 URL 1')).toHaveValue('https://draft.example/menu');
    fireEvent.click(screen.getByText('프로그램 이동')); await screen.findByRole('dialog', { name: '미저장 변경' });
    fireEvent.click(screen.getByText('변경 버리고 이동')); await screen.findByText('다른 화면');
  });
  it('F5/F16 brand409 reload retains edits and a later403 removes cached brand rows and form', async () => {
    let brand = brandFixture(); const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path === 'cafe/brands' ? Promise.resolve({ items: [brand], total: 1, page: 0, size: 50 }) as never : base(path, params));
    vi.mocked(api.rankingWrite).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } }).mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } });
    view('/ranking/cafe/brands'); fireEvent.click(await screen.findByRole('button', { name: '민감 브랜드' }));
    fireEvent.change(screen.getByLabelText('공식 URL 1'), { target: { value: 'https://draft.example/menu' } });
    fireEvent.change(screen.getByLabelText('변경 사유*'), { target: { value: '검토' } });
    fireEvent.click(screen.getByRole('button', { name: '검증 정보 저장' }));
    await screen.findByRole('button', { name: '최신 브랜드 기준 다시 조회 — 초안 유지' });
    brand = { ...brand, verification: { ...brand.verification, revision: 7 } };
    fireEvent.click(screen.getByRole('button', { name: '최신 브랜드 기준 다시 조회 — 초안 유지' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '검증 정보 저장' })).not.toBeDisabled());
    expect(screen.getByLabelText('공식 URL 1')).toHaveValue('https://draft.example/menu');
    fireEvent.click(screen.getByRole('button', { name: '검증 정보 저장' }));
    await screen.findByText(/관리자 권한이 필요합니다/);
    expect(vi.mocked(api.rankingWrite).mock.calls[1][2]).toMatchObject({ expectedRevision: 7 });
    expect(screen.queryByText('민감 브랜드')).not.toBeInTheDocument(); expect(screen.queryByLabelText('공식 URL 1')).not.toBeInTheDocument();
  });
  it('F5/F7 conflict409 reload compares dependencies and retains resolution until explicit submit', async () => {
    let conflict = conflictFixture(); const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path === 'conflicts' ? Promise.resolve(params?.get('size') === '200' && !params.has('conflictId') ? { items: [], total: 201, page: 0, size: 200 } : { items: [conflict], total: 201, page: 4, size: 50 }) as never : base(path, params));
    vi.mocked(api.rankingWrite).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } }).mockResolvedValueOnce(op());
    view('/ranking/conflicts?page=4'); fireEvent.click(await screen.findByRole('button', { name: 'a / 당류(g) 검토' }));
    expect(screen.getByText('400ml')).toBeInTheDocument(); expect(screen.getByText('500ml')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('교정 유지 — 현재 원천 기준 재승인')); fillEvidence();
    fireEvent.click(screen.getByRole('button', { name: '검토 결과 저장' }));
    await screen.findByRole('button', { name: '최신 충돌 다시 조회 — 초안 유지' });
    conflict = { ...conflict, revision: 8, generation: 9 };
    fireEvent.click(screen.getByRole('button', { name: '최신 충돌 다시 조회 — 초안 유지' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '검토 결과 저장' })).not.toBeDisabled());
    expect(vi.mocked(api.rankingGet).mock.calls.some(([path, params]) => path === 'conflicts' && params?.get('conflictId') === 'conflict' && params.get('size') === '1')).toBe(true);
    expect(screen.getByLabelText('교정 유지 — 현재 원천 기준 재승인')).toBeChecked(); expect(screen.getByLabelText('사유*')).toHaveValue('공식 대조');
    fireEvent.click(screen.getByRole('button', { name: '검토 결과 저장' }));
    await waitFor(() => expect(api.rankingWrite).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.rankingWrite).mock.calls[1][2]).toMatchObject({ expectedRevision: 8, sourceGeneration: 9, action: 'KEEP_CORRECTION' });
  });
  it('F11 direct run and board URLs load their requested detail', async () => {
    const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => {
      if (path === 'ingest-runs/run-direct') return Promise.resolve({ run: { runId: 'run-direct', brands: ['a'], status: 'SUCCESS', startedAt: '2026-10-21T00:00:00Z', finishedAt: null, job: 'CAFE_DRINK_BULK', actor: 'INTERNAL_CAFE_COLLECTOR', generationBefore: { a: 1 }, generationAfter: { a: 2 }, checkedAtMin: '2026-10-19', checkedAtMax: '2026-10-20', elapsedMs: 12 }, children: [] }) as never;
      return base(path, params);
    });
    const run = view('/ranking/ingest-runs/run-direct'); await screen.findByText('실행 run-direct · 성공'); expect(screen.getByText(/a 세대 1 → 2/)).toBeInTheDocument(); run.unmount();
    vi.mocked(api.rankingGet).mockImplementation((path, params) => {
      if (path === 'gas/boards') return Promise.resolve({ items: [{ id: 3, title: '직접 보드', health: 'HEALTHY', status: 'OPEN', latestSnapshotId: null }], total: 1, page: 0, size: 50 }) as never;
      return base(path, params);
    });
    view('/ranking/gas/boards/3'); await screen.findByText('직접 보드 · 스냅샷 / 30일 보관');
    expect(vi.mocked(api.rankingGet).mock.calls.some(([path, params]) => path === 'gas/boards' && params?.get('boardId') === '3')).toBe(true);
  });
  it('F12 renders restored per-target correction states and blocks whole revert when one target is stale', async () => {
    const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => {
      if (path === 'audit-events') return Promise.resolve({ items: [{ event: { id: 'audit', operationId: 'operation', actorId: '27', at: '2026-10-21T00:00:00Z', targetKey: 'key1', brandSlug: 'a', reason: '대조', before: { revision: 0, fields: {} }, after: { revision: 1, fields: { sugarG: { action: 'SET', value: '2', state: 'ACTIVE' } } }, sourceGeneration: 1 }, revertible: false, revertBlockedReason: '이후 교정 있음' }], total: 1, page: 0, size: 50 }) as never;
      if (path === 'operations/operation') return Promise.resolve(op('operation')) as never;
      if (path === 'operations/operation/revert-preview') return Promise.resolve({ operationId: 'operation', reversible: false, targets: [{ targetKey: 'key1', before: { revision: 2, fields: { sugarG: { value: '2' } } }, restored: { revision: 0, fields: { sugarG: { value: '5', state: 'ACTIVE' } } }, beforeBrand: null, restoredBrand: null, reversible: false, blockedReason: '이후 교정 있음' }] }) as never;
      return base(path, params);
    });
    view('/ranking/audit'); fireEvent.click(await screen.findByRole('button', { name: '작업 전체 되돌리기 검토' }));
    await screen.findByText('일부 대상 불가 — 전체 실행 잠금'); expect(screen.getByText('당류(g): 2 → 5 (ACTIVE)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1행 되돌리기 실행' })).toBeDisabled();
  });
  it('F12 bulk preview renders server per-target outcomes and locks apply when any target is blocked', async () => {
    view('/ranking/cafe/drinks'); await screen.findByText('브랜드A / 원천메뉴1');
    fireEvent.click(screen.getByLabelText('브랜드A 원천메뉴1 선택')); fireEvent.click(screen.getByLabelText('브랜드A 원천메뉴2 선택'));
    fireEvent.click(screen.getByText('선택 유형 일괄 교정')); await screen.findByText('유형 일괄 교정 / 선택 2행');
    fireEvent.change(screen.getByLabelText('변경할 유형'), { target: { value: '티' } }); fillEvidence();
    vi.mocked(api.rankingWrite).mockResolvedValueOnce({ previewToken: 'server', expiresAt: '2099-01-01T00:00:00Z', changed: ['key1'], unchanged: [], blocked: ['key2'], targets: [{ drinkKey: 'key1', brandSlug: 'a', menuName: '서버 메뉴1', temperature: 'ICE', sizeLabel: 'R', caffeineStatus: 'DECAF', sourceCategory: '공식 분류', derivedGroup: '기타', before: '기타', after: '티', outcome: 'CHANGE' }, { drinkKey: 'key2', brandSlug: 'a', menuName: '서버 메뉴2', before: '기타', after: '티', outcome: 'BLOCKED', blockedReason: '원천 행 없음' }] });
    fireEvent.click(screen.getByRole('button', { name: '미리보기 생성' }));
    await screen.findByText('a / 서버 메뉴1'); expect(screen.getByText(/BLOCKED.*원천 행 없음/)).toBeInTheDocument();
    expect(screen.getByText('공식 분류 / 기타')).toBeInTheDocument(); expect(screen.getByRole('button', { name: '1행 교정 반영' })).toBeDisabled();
  });
  it('F16 later403 clears cached conflict details, original evidence and resolution draft', async () => {
    const conflict = conflictFixture(); conflict.correction.correctionReason = '민감 근거';
    const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path === 'conflicts' ? Promise.resolve({ items: [conflict], total: 1, page: 0, size: 50 }) as never : base(path, params));
    vi.mocked(api.rankingWrite).mockRejectedValueOnce({ isAxiosError: true, response: { status: 403 } });
    view('/ranking/conflicts'); fireEvent.click(await screen.findByRole('button', { name: 'a / 당류(g) 검토' })); fillEvidence();
    expect(screen.getByText(/민감 근거/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: '검토 결과 저장' }));
    await screen.findByText(/관리자 권한이 필요합니다/); expect(screen.queryByText(/민감 근거/)).not.toBeInTheDocument(); expect(screen.queryByLabelText('사유*')).not.toBeInTheDocument();
  });
  it('F13 all-filtered selection above200 is blocked with narrowing guidance', async () => {
    const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path === 'cafe/drinks' ? Promise.resolve({ items: [row(1)], total: 201, page: 0, size: 50 }) as never : base(path, params));
    view('/ranking/cafe/drinks'); await screen.findByText('브랜드A / 원천메뉴1');
    expect(screen.getByRole('button', { name: '필터 결과 201행 선택' })).toBeDisabled(); expect(screen.getByText(/조건을 좁힌 뒤 전체 결과를 선택/)).toBeInTheDocument();
  });

  it('round2 F11 board detail drops the collection offset and loads snapshots from page1', async () => {
    const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => {
      if (path === 'gas/boards') return Promise.resolve(params?.has('boardId') && params.get('page') !== '0' ? { items: [], total: 1, page: 1, size: 50 } : { items: [{ id: 88, title: '두 번째 페이지 보드', health: 'HEALTHY', status: 'OPEN', latestSnapshotId: null }], total: params?.has('boardId') ? 1 : 51, page: params?.has('boardId') ? 0 : 1, size: 50 }) as never;
      return base(path, params);
    });
    view('/ranking/gas/boards?page=1'); fireEvent.click(await screen.findByRole('link', { name: '두 번째 페이지 보드' }));
    await screen.findByText('두 번째 페이지 보드 · 스냅샷 / 30일 보관');
    expect(vi.mocked(api.rankingGet).mock.calls.some(([path, params]) => path === 'gas/boards' && params?.get('boardId') === '88' && params.get('page') === '0')).toBe(true);
  });
  it('round2 F16 response-loss recovery GET403 removes sensitive form and never offers retry', async () => {
    const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path.startsWith('operations/') ? Promise.reject({ isAxiosError: true, response: { status: 403 } }) : base(path, params));
    vi.mocked(api.rankingWrite).mockRejectedValueOnce(new Error('response lost'));
    view('/ranking/cafe/drinks/key1'); await screen.findByText('브랜드A / 원천메뉴1');
    fireEvent.change(screen.getByLabelText('표시명 처리'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByLabelText('표시명 새 값'), { target: { value: '민감 미저장 초안' } }); fillEvidence();
    fireEvent.click(screen.getByRole('button', { name: '교정 저장' })); await screen.findByText(/관리자 권한이 필요합니다/);
    expect(screen.queryByLabelText('표시명 새 값')).not.toBeInTheDocument(); expect(screen.queryByText(/민감 미저장 초안/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '같은 요청 결과 확인·재시도' })).not.toBeInTheDocument(); expect(api.rankingWrite).toHaveBeenCalledTimes(1);
  });
  it('round2 F7 conflict review links the current official source separately from correction evidence', async () => {
    const conflict = conflictFixture(); const base = vi.mocked(api.rankingGet).getMockImplementation()!;
    vi.mocked(api.rankingGet).mockImplementation((path, params) => path === 'conflicts' ? Promise.resolve({ items: [conflict], total: 1, page: 0, size: 50 }) as never : base(path, params));
    view('/ranking/conflicts'); fireEvent.click(await screen.findByRole('button', { name: 'a / 당류(g) 검토' }));
    expect(screen.getByRole('link', { name: '현재 공식 원문' })).toHaveAttribute('href', 'https://official.example/menu');
    expect(screen.getByRole('link', { name: 'https://evidence.example/menu' })).toHaveAttribute('href', 'https://evidence.example/menu');
  });

});
