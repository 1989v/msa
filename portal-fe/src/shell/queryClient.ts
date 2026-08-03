import { QueryClient } from '@tanstack/react-query';

/** 통합 셸 공유 QueryClient — admin/quant 의 기존 설정과 동일(retry 1, 포커스 재요청 off). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
