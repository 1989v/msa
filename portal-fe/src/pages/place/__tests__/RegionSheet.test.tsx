import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  fetchAdministrativeRegions: vi.fn(),
}));

import { fetchAdministrativeRegions } from '../../../api/placeApi';
import RegionSheet from '../RegionSheet';

/*
 * 지역 시트(두 폭 공통). 판정 근거는 그려진 행의 순서·표시와 호출자가 받은 onChange 인자다.
 * 가까운 시도는 googleMaps.nearestRegion 이 고른다 — 여기서는 좌표를 부산 근처로 두어 서울(첫 자료)이 아닌 부산이 올라오는지 본다.
 */
const sido = (code: string, name: string, latitude: number, longitude: number): AdministrativeRegion => ({
  code, parentCode: null, level: 'SIDO', name, nameEn: null, latitude, longitude, attractionCount: 100,
});
const SIDOS = [sido('11', '서울특별시', 37.56, 126.97), sido('26', '부산광역시', 35.18, 129.07), sido('50', '제주특별자치도', 33.49, 126.5)];

function renderSheet(props: Partial<Parameters<typeof RegionSheet>[0]> = {}) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RegionSheet lang="ko" sidoCode={null} sigunguCode={null} onChange={onChange} onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onChange, onClose };
}
const rowNames = (sheet: HTMLElement) =>
  Array.from(sheet.querySelectorAll('.place-region-sheet-list > li > button')).map((b) => b.firstElementChild?.textContent);

beforeEach(() => {
  vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) => Promise.resolve(level === 'SIDO' ? SIDOS : []));
});
afterEach(() => vi.clearAllMocks());

describe('RegionSheet — 가까운 시도', () => {
  it('좌표가 있으면 가장 가까운 시도가 「전체 지역」 다음 첫 시도 행이고 「현재 위치」 표시를 단다 — 선택은 바꾸지 않는다', async () => {
    const { onChange } = renderSheet({ origin: { lat: 35.1, lng: 129.0 } });
    const sheet = await screen.findByRole('dialog', { name: '지역 선택' });
    await within(sheet).findByText('부산광역시');

    expect(rowNames(sheet)).toEqual(['전체 지역', '현재 위치부산광역시', '서울특별시', '제주특별자치도']);
    const near = sheet.querySelectorAll('.place-region-near');
    expect(near).toHaveLength(1);
    expect(near[0]).toHaveTextContent('현재 위치');
    expect(near[0].closest('li')).toBe(sheet.querySelectorAll('.place-region-sheet-list > li')[1]);
    expect(onChange).not.toHaveBeenCalled();
    // 아무것도 고르지 않은 상태 그대로 — 「전체 지역」이 현재 선택이다
    expect(within(sheet).getByRole('button', { name: '전체 지역' })).toHaveAttribute('aria-current', 'true');
  });

  it('좌표가 없으면 자료 순서 그대로이고 표시가 없다', async () => {
    renderSheet();
    const sheet = await screen.findByRole('dialog', { name: '지역 선택' });
    await within(sheet).findByText('부산광역시');
    expect(rowNames(sheet)).toEqual(['전체 지역', '서울특별시', '부산광역시', '제주특별자치도']);
    expect(sheet.querySelector('.place-region-near')).toBeNull();
  });

  it('영문 표시 문구 — Near you', async () => {
    renderSheet({ lang: 'en', origin: { lat: 35.1, lng: 129.0 } });
    const sheet = await screen.findByRole('dialog', { name: 'Choose a region' });
    await within(sheet).findByText('부산광역시');
    expect(sheet.querySelector('.place-region-near')).toHaveTextContent('Near you');
  });

  it('넘긴 className 을 시트에 단다 — 넓은 화면은 kh-sheet--dialog', async () => {
    renderSheet({ className: 'kh-sheet--dialog' });
    expect(await screen.findByRole('dialog', { name: '지역 선택' })).toHaveClass('kh-sheet', 'kh-sheet--dialog');
  });

  it('시도 행 → 시군구 행을 고르면 onChange 에 시도·시군구(뒤 3자리)를 넘기고 닫는다', async () => {
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      Promise.resolve(
        level === 'SIDO'
          ? SIDOS
          : [{ code: '26110', parentCode: '26', level: 'SIGUNGU', name: '중구', nameEn: null, latitude: 35.1, longitude: 129.03, attractionCount: 5 }],
      ),
    );
    const { onChange, onClose } = renderSheet({ origin: { lat: 35.1, lng: 129.0 } });
    const sheet = await screen.findByRole('dialog', { name: '지역 선택' });
    fireEvent.click(await within(sheet).findByRole('button', { name: /부산광역시/ }));
    fireEvent.click(await within(sheet).findByRole('button', { name: /^중구/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sidoCode: '26', sigunguCode: '110' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
