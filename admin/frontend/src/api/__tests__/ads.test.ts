import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../client';
import { createPlacement } from '../ads';

describe('createPlacement', () => {
  afterEach(() => vi.restoreAllMocks());

  it('첫 형태 규격을 formats 목록에 담아 보낸다 — 서버는 옛 모양 생성을 받지 않는다', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, data: {}, error: null } });

    await createPlacement({
      key: 'blog-top',
      host: 'blog.1989v.com',
      format: 'BANNER',
      aspectRatios: ['6.4:1'],
      floorMicros: 50_000,
      active: true,
      paidAllowed: true,
      description: '블로그 위 띠',
    });

    expect(post).toHaveBeenCalledWith('/api/v1/admin/ads/placements', {
      key: 'blog-top',
      host: 'blog.1989v.com',
      active: true,
      paidAllowed: true,
      description: '블로그 위 띠',
      formats: [{ format: 'BANNER', aspectRatios: ['6.4:1'], floorMicros: 50_000 }],
    });
  });
});
