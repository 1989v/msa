import axios from 'axios';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path 사용 (운영 / K8s ingress 경유).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 10_000,
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * /tech 도메인 맵의 루트 — 만들어본 업무 도메인.
 *
 * concept 의 `category`(기술 분류)로는 유도할 수 없는 지식이라 서버가 데이터로 들고 있다.
 * 한 개념이 여러 도메인에 실릴 수 있고, 어느 도메인에도 안 실리는 개념도 있다.
 */
export interface TechDomain {
  code: string;
  label: string;
  tagline: string | null;
  conceptIds: string[];
}

/**
 * 게이트웨이는 업스트림이 죽어 있으면 200 에 빈 바디를 내려보낼 수 있다 — 빈 payload 를
 * 성공으로 넘기면 도메인 루트가 통째로 사라진 맵이 그려진다. 여기서 던져 호출부의
 * 카테고리 폴백으로 보낸다.
 */
function unwrap<T>(body: ApiResponse<T> | '' | null | undefined): T {
  if (!body || !body.success || body.data == null) {
    throw new Error('empty or unsuccessful tech API response');
  }
  return body.data;
}

/** 모듈 스코프 캐시 — 도메인 정의는 세션 중 바뀌지 않으므로 탭을 오가도 한 번만 받는다. */
let inflight: Promise<TechDomain[]> | null = null;

export const fetchTechDomains = (): Promise<TechDomain[]> => {
  if (!inflight) {
    inflight = api
      .get<ApiResponse<TechDomain[]>>('/api/v1/tech/domains')
      .then((res) => unwrap(res.data))
      // 실패는 캐시하지 않는다 — 다음 마운트에서 다시 시도할 수 있어야 한다
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
};
