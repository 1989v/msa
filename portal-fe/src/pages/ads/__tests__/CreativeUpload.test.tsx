import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../../api/adsConsoleApi';
import * as auth from '../../../auth/auth';
import { RULES, advertiser, campaignOf, catalogWith, renderEditor } from './consoleFixtures';
import { imageFile, jpegBytes, pngBytes } from './imageFixtures';

vi.mock('../../../api/adsConsoleApi', async () => {
  const actual = await vi.importActual<typeof api>('../../../api/adsConsoleApi');
  return {
    ...actual,
    fetchAdvertiserMe: vi.fn(),
    fetchCampaign: vi.fn(),
    fetchCreatives: vi.fn(),
    fetchCatalog: vi.fn(),
    submitCreative: vi.fn(),
    reviseCreative: vi.fn(),
  };
});

vi.mock('../../../auth/auth', async () => {
  const actual = await vi.importActual<typeof auth>('../../../auth/auth');
  return { ...actual, isLoggedIn: vi.fn() };
});

/**
 * C5 — 소재 업로드 사전 검사. 판정은 화면이 그린 검사표와 전송 함수 호출(대상의 산출물)로 본다.
 * 캠페인은 띠배너이고 `game-list-banner`(6.4:1)를 타기팅한다.
 */

const STRIP = () => imageFile(pngBytes(1280, 200), 'strip.png');

const createObjectURL = vi.fn(() => 'blob:preview');
const createImageBitmap = vi.fn();

async function openPanel() {
  renderEditor('/campaigns/11');
  return screen.findByTestId('creative-drop');
}

function drop(target: Window | Element, files: File[], types = ['Files']) {
  return fireEvent.drop(target, { dataTransfer: { files, types } });
}

/** 문구 칸을 채운다 — 전송을 막는 것이 이미지 검사뿐이게 */
async function fillText() {
  await userEvent.type(screen.getByLabelText(/^대체 텍스트/), '가을 원서 모임');
  await userEvent.clear(screen.getByLabelText('랜딩 URL(https)'));
  await userEvent.type(screen.getByLabelText('랜딩 URL(https)'), 'https://example.com');
}

const check = (key: string) => document.querySelector(`[data-check="${key}"]`) as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.isLoggedIn).mockReturnValue(true);
  vi.mocked(api.fetchAdvertiserMe).mockResolvedValue(advertiser);
  vi.mocked(api.fetchCatalog).mockResolvedValue(catalogWith());
  vi.mocked(api.fetchCampaign).mockResolvedValue(campaignOf());
  vi.mocked(api.fetchCreatives).mockResolvedValue([]);
  vi.mocked(api.submitCreative).mockReturnValue(new Promise(() => {}));
  vi.mocked(api.reviseCreative).mockReturnValue(new Promise(() => {}));
  // 이미지를 푸는 두 길 — 어느 쪽이든 불리면 검사 전에 디코딩한 것이다
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal('createImageBitmap', createImageBitmap);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('소재 업로드 — 보내기 전 검사', () => {
  it('MIME 이 빈 PNG 도 앞 바이트로 판정해 통과하고, 통과한 뒤에만 미리보기를 푼다 — 띠배너는 대체 텍스트만 보낸다', async () => {
    const zone = await openPanel();
    drop(zone, [STRIP()]);

    await waitFor(() => expect(check('ratio')).toHaveTextContent('✓'));
    expect(check('format')).toHaveTextContent('PNG');
    expect(check('dimension')).toHaveTextContent('1280×200');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(zone.querySelector('img.adc-upload__preview--banner')).not.toBeNull();

    await fillText();
    await userEvent.click(screen.getByRole('button', { name: '심사 요청' }));

    await waitFor(() => expect(api.submitCreative).toHaveBeenCalledTimes(1));
    const [campaignId, input] = vi.mocked(api.submitCreative).mock.calls[0];
    expect(campaignId).toBe(11);
    expect(input).toMatchObject({ title: '가을 원서 모임', body: '', landingUrl: 'https://example.com' });
    expect(input.image?.name).toBe('strip.png');
  });

  it('확장자·MIME 이 PNG 여도 앞 바이트가 JPEG 면 JPEG 로 판정한다', async () => {
    const zone = await openPanel();
    drop(zone, [imageFile(jpegBytes(1280, 200), 'fake.png', 'image/png')]);

    await waitFor(() => expect(check('format')).toHaveTextContent('JPEG'));
    expect(check('dimension')).toHaveTextContent('1280×200');
  });

  it('비율이 형태 규격과 다르면 실제 값·허용 값·권장 크기를 보이고 보내지 않는다', async () => {
    const zone = await openPanel();
    drop(zone, [imageFile(pngBytes(1200, 628), 'card.png')]);

    await waitFor(() => expect(check('ratio')).toHaveTextContent('✕'));
    expect(check('ratio')).toHaveTextContent('6.4:1');
    expect(check('ratio')).toHaveTextContent('1200×628');
    expect(within(zone).getByRole('alert')).toHaveTextContent('권장 크기 1280×200');
    expect(createObjectURL).not.toHaveBeenCalled();

    await fillText();
    await userEvent.click(screen.getByRole('button', { name: '심사 요청' }));
    expect(await screen.findByText('이미지가 검사를 통과하지 못해 보내지 않았습니다.')).toBeInTheDocument();
    expect(api.submitCreative).not.toHaveBeenCalled();
  });

  it('헤더 폭탄(20000×3125)은 풀지 않고 헤더 값으로 거절한다', async () => {
    const zone = await openPanel();
    drop(zone, [imageFile(pngBytes(20000, 3125), 'bomb.png')]);

    await waitFor(() => expect(check('dimension')).toHaveTextContent('✕'));
    expect(check('dimension')).toHaveTextContent('20000×3125');
    expect(check('dimension')).toHaveTextContent('2,000px 이하');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(createImageBitmap).not.toHaveBeenCalled();

    await fillText();
    await userEvent.click(screen.getByRole('button', { name: '심사 요청' }));
    expect(await screen.findByText('이미지가 검사를 통과하지 못해 보내지 않았습니다.')).toBeInTheDocument();
    expect(api.submitCreative).not.toHaveBeenCalled();
  });

  it('용량 한도는 카탈로그 업로드 규칙을 따른다 — 규칙이 바뀌면 같은 파일의 판정도 바뀐다', async () => {
    const file = () => imageFile(pngBytes(1280, 200, 2048), 'strip.png');
    vi.mocked(api.fetchCatalog).mockResolvedValue(catalogWith({ ...RULES, maxBytes: 1024 }));
    const small = await openPanel();
    drop(small, [file()]);
    await waitFor(() => expect(check('bytes')).toHaveTextContent('✕'));
    expect(check('bytes')).toHaveTextContent('1KB 이하');
    expect(check('bytes')).toHaveTextContent('2KB');
  });

  it('같은 파일이 기본 규칙(300KB)에서는 통과한다', async () => {
    const zone = await openPanel();
    drop(zone, [imageFile(pngBytes(1280, 200, 2048), 'strip.png')]);

    await waitFor(() => expect(check('bytes')).toHaveTextContent('✓'));
  });
});

describe('소재 업로드 — 끌어다 놓기 예외', () => {
  it('여러 파일을 놓으면 첫 파일만 쓰고 알린다', async () => {
    const zone = await openPanel();
    drop(zone, [STRIP(), imageFile(pngBytes(1200, 628), 'second.png')]);

    expect(await screen.findByText('파일을 2개 놓아 첫 파일(strip.png)만 씁니다.')).toBeInTheDocument();
    expect(within(zone).getByText('strip.png')).toBeInTheDocument();
    expect(within(zone).queryByText('second.png')).not.toBeInTheDocument();
  });

  it('영역 밖에 파일을 놓으면 창의 기본 동작(파일 열기)을 막는다 — 글자 끌기는 막지 않는다', async () => {
    await openPanel();
    expect(drop(window, [STRIP()])).toBe(false);
    expect(fireEvent.dragOver(window, { dataTransfer: { files: [], types: ['Files'] } })).toBe(false);
    expect(drop(window, [], ['text/plain'])).toBe(true);
  });

  it('고치기 모드에서 놓은 파일은 취소할 수 있고, 그러면 이미지 없이 문구만 고친다', async () => {
    vi.mocked(api.fetchCreatives).mockResolvedValue([
      {
        id: 21, campaignId: 11, status: 'REJECTED', title: '가을 원서 모임', body: '',
        landingUrl: 'https://example.com', imageUrl: null, rejectReason: 'MISLEADING', reviewedAt: null,
      },
    ]);
    const zone = await openPanel();
    await userEvent.click(await screen.findByRole('button', { name: '고치기' }));
    drop(zone, [STRIP()]);
    await waitFor(() => expect(check('ratio')).toHaveTextContent('✓'));

    await userEvent.click(within(zone).getByRole('button', { name: '파일 취소' }));
    expect(within(zone).queryByText('strip.png')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '고친 내용으로 다시 심사' }));

    await waitFor(() => expect(api.reviseCreative).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.reviseCreative).mock.calls[0][1].image).toBeNull();
  });

  it('종료된 캠페인에는 드롭 영역이 없고 창의 드롭도 가로채지 않는다', async () => {
    vi.mocked(api.fetchCampaign).mockResolvedValue(campaignOf({ status: 'ENDED' }));
    renderEditor('/campaigns/11');
    await screen.findByRole('heading', { name: '소재' });

    expect(screen.queryByTestId('creative-drop')).not.toBeInTheDocument();
    expect(drop(window, [STRIP()])).toBe(true);
  });
});
