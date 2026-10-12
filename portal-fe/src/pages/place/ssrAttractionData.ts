import type { AttractionDetail, PlaceLang } from '../../api/placeApi';

/** 서버 렌더(search `AttractionPageRenderer`)가 `#root` 앞에 싣는 상세 데이터 노드 id */
export const SSR_ATTRACTION_DATA_ID = 'attraction-data';

/**
 * 서버 렌더가 실어 보낸 상세 데이터를 꺼낸다. 상세 API(`/api/search/attractions/{id}`)의 `data` 와 같은 모양이다.
 *
 * 노드는 읽자마자 지운다 — 남겨 두면 SPA 안에서 다른 상세로 옮겨 갔을 때 앞 문서의 데이터가 다시 읽힌다.
 * 지금 경로의 id·언어와 다르거나 읽을 수 없으면 undefined 이고, 화면은 그때 API 를 부른다.
 */
export function takeSsrAttraction(id: string, lang: PlaceLang): AttractionDetail | undefined {
  if (typeof document === 'undefined') return undefined;
  const node = document.getElementById(SSR_ATTRACTION_DATA_ID);
  if (!node) return undefined;
  const text = node.textContent ?? '';
  node.remove();
  try {
    const data = JSON.parse(text) as AttractionDetail | null;
    if (!data || typeof data !== 'object' || String(data.id) !== id) return undefined;
    const docLang: PlaceLang = data.lang === 'en' ? 'en' : 'ko';
    return docLang === lang ? data : undefined;
  } catch {
    return undefined;
  }
}
