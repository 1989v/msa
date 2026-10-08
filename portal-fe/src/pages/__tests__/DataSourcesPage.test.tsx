import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DataSourcesPage from '../DataSourcesPage';
import { DATA_SOURCES, DATA_SOURCE_NOTICES } from '../../seo/dataSources.mjs';

// 상단 바는 로그인·이력서 상태를 네트워크로 묻는다 — 이 테스트는 본문 표만 본다.
vi.mock('../../components/GNB', () => ({ default: () => null }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <DataSourcesPage />
    </MemoryRouter>,
  );

describe('데이터 출처 페이지', () => {
  // jsdom 에는 등장 연출 훅(useReveal)이 쓰는 두 API 가 없다 — 모션은 이 테스트의 관심사가 아니다.
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    vi.stubGlobal('IntersectionObserver', vi.fn().mockReturnValue({ observe: vi.fn(), disconnect: vi.fn() }));
  });

  it('표 본문이 상수의 행을 순서대로 네 열(데이터·원천·라이선스·비고)로 그린다', () => {
    const { container } = renderPage();
    const trs = [...container.querySelectorAll('table tbody tr')];
    expect(trs.length).toBe(DATA_SOURCES.length);
    trs.forEach((tr, i) => {
      const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent);
      const row = DATA_SOURCES[i];
      expect(cells).toEqual([row.data, row.source, row.license, row.note]);
    });
  });

  it('표 아래에 라이선스 고지를 모두 싣는다', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    for (const notice of DATA_SOURCE_NOTICES) {
      expect(text).toContain(notice.text);
      if (notice.href) expect(container.querySelector(`a[href="${notice.href}"]`)).not.toBeNull();
    }
  });
});
