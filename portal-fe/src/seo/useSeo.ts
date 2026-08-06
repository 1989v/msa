import { useEffect } from 'react';

export interface SeoAlternate {
  hreflang: string;
  href: string;
}

export interface SeoInput {
  title: string;
  description?: string;
  canonical?: string;
  /** 소셜 카드 이미지 절대 URL. 래스터(png/jpg)만 — SVG 는 언퍼러가 렌더하지 못한다 */
  image?: string | null;
  type?: 'website' | 'article';
  lang?: 'ko' | 'en';
  alternates?: SeoAlternate[];
  jsonLd?: unknown[];
  /** 로그인·주문내역처럼 색인하면 안 되는 페이지 */
  noindex?: boolean;
}

const MULTI = 'data-seo-multi';

/**
 * head 메타를 라우트에 맞춰 갱신한다.
 *
 * 프리렌더된 페이지(scripts/prerender-seo.mjs)는 같은 값을 이미 HTML 로 갖고 있어
 * 여기서는 덮어쓰기가 no-op 이고, SPA 내부 전환에서만 실제로 값이 바뀐다.
 */
export function useSeo(input: SeoInput): void {
  const {
    title,
    description,
    canonical,
    image,
    type = 'website',
    lang = 'ko',
    alternates,
    jsonLd,
    noindex,
  } = input;
  // 배열/객체를 그대로 deps 에 넣으면 매 렌더 새 참조라 무한 갱신된다
  const key = JSON.stringify([title, description, canonical, image, type, lang, alternates, jsonLd, noindex]);

  useEffect(() => {
    // 빈 title = "아직 확정할 데이터가 없음". 프리렌더로 심어둔 메타를 로딩 중에 덮어쓰지 않는다.
    if (!title) return;
    document.title = title;
    document.documentElement.lang = lang;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, follow' : null);
    upsertLink('canonical', canonical);

    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:locale', lang === 'en' ? 'en_US' : 'ko_KR');
    upsertMeta('property', 'og:image', image ?? null);

    upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image ?? null);

    // 개수가 라우트마다 달라지는 태그는 통째로 교체
    document.head.querySelectorAll(`[${MULTI}]`).forEach((el) => el.remove());
    alternates?.forEach((alt) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = alt.hreflang;
      link.href = alt.href;
      link.setAttribute(MULTI, '');
      document.head.appendChild(link);
    });
    jsonLd?.forEach((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      script.setAttribute(MULTI, '');
      document.head.appendChild(script);
    });
    // key 가 위 값 전체를 직렬화한 것이라 개별 의존성을 다시 나열하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null | undefined): void {
  const selector = `meta[${attr}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    existing?.remove();
    return;
  }
  const meta = existing ?? document.head.appendChild(document.createElement('meta'));
  meta.setAttribute(attr, key);
  meta.setAttribute('content', content);
}

function upsertLink(rel: string, href: string | undefined): void {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.head.appendChild(document.createElement('link'));
  link.rel = rel;
  link.href = href;
}
