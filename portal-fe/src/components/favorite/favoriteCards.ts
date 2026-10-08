import { fetchGameDetail } from '../../api/gameApi';
import { fetchPost } from '../../api/blogApi';
import { fetchAttraction } from '../../api/placeApi';
import { fetchProduct } from '../../api/shopApi';
import type { FavoriteTargetType } from '../../api/wishlistApi';
import { secureImageUrl, titleParts } from '../../pages/place/placeView';
import { formatWon } from '../../pages/shopFormat';
import { BLOG_ORIGIN } from '../../seo/copy.mjs';
import { isApexProd } from '../../shell/serviceHref';

/** 하이드레이션된 카드 한 장 — 타입이 달라도 목록은 같은 모양으로 그린다 */
export interface FavoriteCard {
  targetKey: string;
  /** 소속 묶음 — null 이면 미분류 (ADR-0080). 하이드레이션 뒤 목록이 채운다 */
  collectionId: number | null;
  title: string;
  meta: string;
  imageUrl: string | null;
  href: string;
  /** apex 에 라우트가 없는 대상(blog)은 절대 URL 로 나간다 */
  external: boolean;
}

/**
 * 대상 상세는 각 서비스 공개 API 로 키별 조회한다 (ADR-0074 — wishlist 는 키만 안다).
 * 실패(삭제·비공개 전환)는 null 로 접어 목록에서 건너뛴다.
 */
export type HydratedCard = Omit<FavoriteCard, 'collectionId'>;

export async function hydrate(type: FavoriteTargetType, key: string): Promise<HydratedCard | null> {
  try {
    switch (type) {
      case 'GAME': {
        const game = await fetchGameDetail(key);
        return {
          targetKey: key,
          title: game.title,
          meta: `${game.playCount.toLocaleString()} plays`,
          imageUrl: game.thumbnailUrl || null,
          href: `/games/${key}`,
          external: false,
        };
      }
      case 'ATTRACTION': {
        const attraction = await fetchAttraction(key);
        // 원어 병기명은 제목에 괄호로 합치지 않는다 — titleParts 계약 (place t1/t2)
        const { primary, secondary } = titleParts(attraction);
        return {
          targetKey: key,
          title: primary,
          meta: [secondary, attraction.address ?? attraction.category]
            .filter(Boolean)
            .join(' · '),
          imageUrl: secureImageUrl(attraction.imageUrl),
          href: `/attractions/${key}`,
          external: false,
        };
      }
      case 'BLOG_POST': {
        const detail = await fetchPost(key);
        return {
          targetKey: key,
          title: detail.post.title,
          meta: `${detail.post.categoryName} · ${detail.post.author.displayName}`,
          imageUrl: detail.post.coverImageUrl,
          // blog 의 짧은 주소(/posts/:slug)는 apex 프로덕션에 라우트가 없다 (canonical 분리)
          href: isApexProd ? `${BLOG_ORIGIN}/posts/${key}` : `/posts/${key}`,
          external: isApexProd,
        };
      }
      case 'PRODUCT': {
        const product = await fetchProduct(key);
        return {
          targetKey: key,
          title: product.name,
          meta: formatWon(product.price),
          imageUrl: null,
          href: `/shop/products/${key}`,
          external: false,
        };
      }
    }
  } catch {
    return null;
  }
}
