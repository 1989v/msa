import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@/api/marketGeometry';
import type { Geometry } from '@/api/marketGeometry';
import { GeometryEditor } from '../GeometryEditor';
vi.mock('@/api/marketGeometry', () => ({ getGeometry: vi.fn(), getNeedsReview: vi.fn(), saveBoundary: vi.fn(), resetBoundary: vi.fn(), savePath: vi.fn(), saveEntrance: vi.fn(), saveRoadRule: vi.fn(), deleteGeometryItem: vi.fn(), saveGeo: vi.fn(), assignStorePath: vi.fn() }));
const geometry: Geometry = { boundary: { polygon: [[37, 127], [37.001, 127], [37.001, 127.001]], source: 'OSM', osmId: 'way/1' }, paths: [{ id: 4, name: '시장길', named: true, geometry: [[37, 127], [37.001, 127.001]], source: 'OSM' }], entrances: [], roadRules: [], geo: { centerLat: 37, centerLng: 127, radiusM: 300, centerOverridden: true, radiusOverridden: true }, background: { roads: [] }, attribution: ['© OpenStreetMap contributors'] };
async function setup() { render(<GeometryEditor marketId={1} onChanged={vi.fn()} />); await screen.findByRole('button', { name: '경계 저장' }); }
function reason() { fireEvent.change(screen.getByLabelText('구조 수정 이유 (필수)'), { target: { value: '  현장 확인  ' } }); }
describe('alley geometry editor', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('draws and cancels a path, shows entrance draft, and drags a boundary vertex', async () => {
    await setup(); reason(); vi.stubGlobal('PointerEvent', MouseEvent);
    vi.stubGlobal('DOMPoint', class { x: number; y: number; constructor(x: number, y: number) { this.x = x; this.y = y; } matrixTransform() { return this; } });
    const svg = screen.getByLabelText('골목 구조 편집 지도');
    Object.defineProperty(svg, 'getScreenCTM', { value: () => ({ inverse: () => ({}) }) });
    fireEvent.click(screen.getByRole('button', { name: '골목 선 그리기' }));
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 }); fireEvent.pointerDown(svg, { clientX: 200, clientY: 200 });
    expect(screen.getByRole('button', { name: '골목 저장 · 그리기 완료' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '그리기 취소' })); expect(api.savePath).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '출입구 찍기' })); fireEvent.pointerDown(svg, { clientX: 120, clientY: 160 });
    expect(screen.getByText('새 출입구 위치')).toBeInTheDocument(); expect(screen.getByRole('button', { name: '출입구 저장' })).toBeEnabled();
    const vertex = screen.getByRole('button', { name: '경계 꼭짓점 1' }); Object.defineProperty(vertex, 'setPointerCapture', { value: vi.fn() });
    fireEvent.pointerDown(vertex, { clientX: 100, clientY: 100 }); fireEvent.pointerMove(svg, { clientX: 220, clientY: 240 }); fireEvent.pointerUp(svg);
    fireEvent.click(screen.getByRole('button', { name: '경계 저장' })); await waitFor(() => expect(api.saveBoundary).toHaveBeenCalled());
    expect(vi.mocked(api.saveBoundary).mock.calls[0][1][0]).not.toEqual(geometry.boundary!.polygon[0]);
  });
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.getGeometry).mockResolvedValue(geometry); vi.mocked(api.getNeedsReview).mockResolvedValue([{ storeId: 8, name: '떡집', roadAddress: '시장길 1', lat: 37, lng: 127, pathId: null, suggestedPathId: 4 }]); vi.mocked(api.saveBoundary).mockResolvedValue({ boundary: geometry.boundary!, rejudge: { changedStores: 12 } }); vi.mocked(api.deleteGeometryItem).mockResolvedValue({ rejudge: { changedStores: 2 } }); vi.mocked(api.assignStorePath).mockResolvedValue({ rejudge: { changedStores: 1 } }); vi.mocked(api.saveGeo).mockResolvedValue({ geo: geometry.geo, rejudge: { changedStores: 3 } }); });
  it('requires trimmed reason, inserts midpoint and saves exact lat/lng vertices and rejudge text', async () => {
    await setup(); const save = screen.getByRole('button', { name: '경계 저장' }); expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('구조 수정 이유 (필수)'), { target: { value: '  ' } }); expect(save).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('button', { name: '꼭짓점 1 뒤 추가' }), { key: 'Enter' }); expect(screen.getAllByRole('button', { name: /경계 꼭짓점/ })).toHaveLength(4);
    reason(); fireEvent.click(save); await waitFor(() => expect(api.saveBoundary).toHaveBeenCalledWith(1, [[37, 127], [37.0005, 127], [37.001, 127], [37.001, 127.001]], '현장 확인'));
    expect(await screen.findByText('가게 12곳 판정이 바뀌었습니다')).toBeInTheDocument(); expect(screen.getByText('© OpenStreetMap contributors')).toBeInTheDocument();
  });
  it('requires inline confirmation for deleting a path', async () => {
    await setup(); expect(screen.getByRole('button', { name: '골목 삭제 4' })).toBeDisabled(); reason(); fireEvent.click(screen.getByRole('button', { name: '골목 삭제 4' })); expect(api.deleteGeometryItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '삭제 취소' })); expect(api.deleteGeometryItem).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '골목 삭제 4' })); fireEvent.click(screen.getByRole('button', { name: '삭제 확인' })); await waitFor(() => expect(api.deleteGeometryItem).toHaveBeenCalledWith(1, 'paths', 4, '현장 확인'));
  });
  it('defaults review to suggestedPathId and submits it', async () => {
    await setup(); expect(screen.getByLabelText('떡집 골목')).toHaveValue('4'); expect(screen.getByRole('button', { name: '떡집 골목 지정' })).toBeDisabled(); reason(); fireEvent.click(screen.getByRole('button', { name: '떡집 골목 지정' })); await waitFor(() => expect(api.assignStorePath).toHaveBeenCalledWith(1, 8, 4, '현장 확인'));
  });
  it('clears center and radius independently', async () => {
    await setup(); reason(); fireEvent.click(screen.getByRole('button', { name: '중심 보정 해제' })); await waitFor(() => expect(api.saveGeo).toHaveBeenCalledWith(1, { centerLat: null, centerLng: null, radiusM: 300, reason: '현장 확인' })); await waitFor(() => expect(screen.getByRole('button', { name: '반경 보정 해제' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: '반경 보정 해제' })); await waitFor(() => expect(api.saveGeo).toHaveBeenCalledWith(1, { centerLat: 37, centerLng: 127, radiusM: null, reason: '현장 확인' }));
  });
  it('requires inline vertex deletion and preserves at least three vertices', async () => {
    await setup(); fireEvent.keyDown(screen.getByRole('button', { name: '경계 꼭짓점 1' }), { key: 'Enter' }); expect(screen.getByRole('button', { name: '꼭짓점 삭제' })).toBeDisabled(); fireEvent.keyDown(screen.getByRole('button', { name: '꼭짓점 1 뒤 추가' }), { key: 'Enter' }); fireEvent.click(screen.getByRole('button', { name: '꼭짓점 삭제' })); expect(screen.getAllByRole('button', { name: /경계 꼭짓점/ })).toHaveLength(4); fireEvent.click(screen.getByRole('button', { name: '꼭짓점 삭제 확인' })); expect(screen.getAllByRole('button', { name: /경계 꼭짓점/ })).toHaveLength(3);
  });
});
