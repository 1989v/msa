import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import {
  fetchProducts,
  searchProducts,
  postImpressions,
  postClick,
  type ProductSummary,
  type SearchProduct,
  extractErrorMessage,
} from '../api/shopApi';
import { getUserId } from '../auth/auth';
import { formatWon } from './shopFormat';
import './Shop.css';

const PAGE_SIZE = 20;

/** 브라우즈(/api/products)와 검색(/api/search/products) 결과를 카드 렌더용으로 통일 */
interface DisplayProduct {
  key: string;
  productId: string;
  name: string;
  price: string | number;
  status: string;
  stock: number | null; // 검색 결과에는 stock 없음
  categoryId: string | null;
  position: number | null; // 검색 결과 전용 (클릭 이벤트)
}

interface PageData {
  mode: 'browse' | 'search';
  searchId: string | null;
  products: DisplayProduct[];
  totalElements: number;
  totalPages: number;
}

function fromBrowse(p: ProductSummary): DisplayProduct {
  return {
    key: `b-${p.id}`,
    productId: String(p.id),
    name: p.name,
    price: p.price,
    status: p.status,
    stock: p.stock,
    categoryId: null,
    position: null,
  };
}

function fromSearch(p: SearchProduct): DisplayProduct {
  return {
    key: `s-${p.id}`,
    productId: p.id,
    name: p.name,
    price: p.price,
    status: p.status,
    stock: null,
    categoryId: p.categoryId,
    position: p.position,
  };
}

export default function ShopPage() {
  const navigate = useNavigate();
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState(''); // 제출된 검색어
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (keyword.trim() === '') {
          const res = await fetchProducts(page, PAGE_SIZE);
          if (cancelled) return;
          setData({
            mode: 'browse',
            searchId: null,
            products: res.products.map(fromBrowse),
            totalElements: res.totalElements,
            totalPages: res.totalPages,
          });
        } else {
          const res = await searchProducts(keyword, page, PAGE_SIZE);
          if (cancelled) return;
          setData({
            mode: 'search',
            searchId: res.searchId,
            products: res.products.map(fromSearch),
            totalElements: res.totalElements,
            totalPages: res.totalPages,
          });
          // 노출(impression) 이벤트 — 검색 결과 렌더당 1회, fire-and-forget
          if (res.products.length > 0) {
            const userId = getUserId();
            postImpressions({
              searchId: res.searchId,
              ...(userId ? { userId } : {}),
              items: res.products.map((p) => ({
                categoryId: p.categoryId,
                productId: p.id,
                position: p.position,
              })),
            }).catch(() => {
              // 행동 로그 실패는 UX 에 영향 없음
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(extractErrorMessage(e, '상품을 불러오지 못했습니다.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [keyword, page]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(0);
  };

  const handleCardClick = useCallback(
    (product: DisplayProduct) => {
      if (product.status !== 'ACTIVE') return;
      // 검색 결과 카드면 클릭 이벤트 발행 (fire-and-forget)
      if (data?.mode === 'search' && data.searchId && product.position != null) {
        const userId = getUserId();
        postClick({
          searchId: data.searchId,
          ...(userId ? { userId } : {}),
          categoryId: product.categoryId,
          productId: product.productId,
          position: product.position,
        }).catch(() => {
          // 행동 로그 실패는 무시
        });
      }
      navigate(`/shop/products/${product.productId}`);
    },
    [data, navigate],
  );

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container">
        <h1 className="shop-page-title">상품 둘러보기</h1>

        <form className="shop-search-form" onSubmit={handleSubmit} role="search">
          <input
            type="search"
            className="shop-search-input"
            placeholder="상품명으로 검색"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            aria-label="상품 검색"
          />
          <button type="submit" className="shop-btn-primary">
            검색
          </button>
        </form>

        {loading && (
          <div className="shop-product-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="shop-skeleton-card" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="shop-status shop-status-error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && data && data.products.length === 0 && (
          <div className="shop-status">
            {data.mode === 'search' ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}
          </div>
        )}

        {!loading && !error && data && data.products.length > 0 && (
          <>
            <div className="shop-product-grid">
              {data.products.map((product) => {
                const clickable = product.status === 'ACTIVE';
                return (
                  <button
                    key={product.key}
                    type="button"
                    className={`shop-product-card${clickable ? '' : ' is-disabled'}`}
                    onClick={() => handleCardClick(product)}
                    disabled={!clickable}
                  >
                    <span className="shop-product-name">{product.name}</span>
                    <span className="shop-product-price">{formatWon(product.price)}</span>
                    <span className="shop-product-meta">
                      {product.stock != null && product.stock > 0 && (
                        <span className="shop-badge shop-badge-stock">재고 {product.stock}</span>
                      )}
                      {product.stock === 0 && (
                        <span className="shop-badge shop-badge-soldout">품절</span>
                      )}
                      {!clickable && (
                        <span className="shop-badge shop-badge-inactive">판매중지</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="shop-pagination" aria-label="페이지네이션">
                <button
                  type="button"
                  className="shop-btn-secondary"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0}
                >
                  이전
                </button>
                <span className="shop-pagination-info">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className="shop-btn-secondary"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  다음
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
