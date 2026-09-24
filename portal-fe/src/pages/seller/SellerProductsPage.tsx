import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ShopHeader from '../../components/ShopHeader';
import { portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import {
  createSellerProduct,
  errorStatus,
  extractErrorMessage,
  fetchMySeller,
  fetchMySellerApplication,
  fetchSellerProducts,
  updateSellerProduct,
  type ProductSummary,
  type SellerApplication,
} from '../../api/shopApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import { formatWon } from '../shopFormat';
import SellerApplicationPanel from './SellerApplicationPanel';
import {
  EMPTY_PRODUCT_FORM,
  validateProductForm,
  type ProductFormErrors,
  type ProductFormValues,
} from './sellerForm';
import '../Shop.css';
import './Seller.css';

/** 목록 API 최대 쪽 크기(@Max(500)) */
const LIST_PAGE_SIZE = 500;

/** 서버가 판매자로 거른다 — 보통 한 번이고, 500개를 넘을 때만 다음 쪽을 더 부른다 */
async function fetchOwnProducts(sellerId: number): Promise<ProductSummary[]> {
  const first = await fetchSellerProducts(sellerId, 0, LIST_PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) =>
      fetchSellerProducts(sellerId, i + 1, LIST_PAGE_SIZE),
    ),
  );
  return [first, ...rest].flatMap((p) => p.products);
}

type Load =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'application'; application: SellerApplication }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; application: SellerApplication; products: ProductSummary[] };

type Editing = { mode: 'create' } | { mode: 'edit'; product: ProductSummary } | null;

/**
 * 신청 상태(`/sellers/me`)를 먼저 본다 — ACTIVE 일 때만 판매자 포털(`/seller/me`)과 상품 목록으로 간다.
 * 심사 중·반려·정지는 상태와 사유를 보여 주고 끝난다.
 */
async function loadSellerProducts(): Promise<Load> {
  try {
    const application = await fetchMySellerApplication();
    if (!application) return { kind: 'none' };
    if (application.status !== 'ACTIVE') return { kind: 'application', application };
    const me = await fetchMySeller();
    return { kind: 'ready', application, products: await fetchOwnProducts(me.id) };
  } catch (err) {
    return {
      kind: 'error',
      message:
        errorStatus(err) === 403
          ? '승인이 판매자 권한에 반영되는 중입니다. 잠시 뒤 다시 시도해 주세요.'
          : extractErrorMessage(err, '판매자 정보를 불러오지 못했습니다.'),
    };
  }
}

const PRODUCT_STATUS_LABEL: Record<string, string> = { ACTIVE: '판매 중', INACTIVE: '판매 중지' };

function toForm(p: ProductSummary): ProductFormValues {
  return {
    name: p.name,
    price: String(Math.round(Number(p.price))),
    stock: String(p.stock),
    brand: p.brand ?? '',
    category: p.category ?? '',
    description: p.description ?? '',
  };
}

export default function SellerProductsPage() {
  useHeritageSurface();
  useSeo({ title: portalTitle('내 상품'), canonical: portalUrl('/shop/seller/products'), noindex: true });

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => setLoad(await loadSellerProducts()), []);

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.replace(buildLoginHref('/shop/seller/products'));
      return;
    }
    let cancelled = false;
    loadSellerProducts().then((next) => {
      if (!cancelled) setLoad(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = async (message: string) => {
    setEditing(null);
    setNotice(message);
    await reload();
  };

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container seller-container">
        <header className="seller-head">
          <span className="kh-section-label">Seller</span>
          <h1 className="shop-page-title">내 상품</h1>
        </header>

        {load.kind === 'loading' && (
          <div className="shop-order-list" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="shop-skeleton-card kh-skeleton" />
            ))}
          </div>
        )}

        {load.kind === 'none' && (
          <section className="kh-status seller-gate" role="status">
            <p className="kh-status-title">아직 입점 신청이 없습니다</p>
            <p>입점 신청을 하고 승인되면 이 화면에서 상품을 등록할 수 있습니다.</p>
            <div>
              <Link to="/shop/seller/apply" className="kh-button">
                입점 신청
              </Link>
            </div>
          </section>
        )}

        {load.kind === 'application' && <SellerApplicationPanel application={load.application} />}

        {load.kind === 'error' && (
          <div className="kh-status kh-status-error" role="alert">
            <p className="kh-status-title">불러오지 못했습니다</p>
            <p>{load.message}</p>
            <div>
              <button type="button" className="kh-button kh-button-ghost" onClick={() => void reload()}>
                다시 시도
              </button>
            </div>
          </div>
        )}

        {load.kind === 'ready' && (
          <>
            <SellerApplicationPanel application={load.application} showActions={false} />

            <div className="seller-toolbar">
              {notice && (
                <span className="seller-hint" role="status">
                  {notice}
                </span>
              )}
              <button
                type="button"
                className="kh-button"
                onClick={() => {
                  setNotice(null);
                  setEditing({ mode: 'create' });
                }}
              >
                상품 등록
              </button>
            </div>

            {editing && (
              <ProductForm
                key={editing.mode === 'edit' ? editing.product.id : 'new'}
                editing={editing}
                onCancel={() => setEditing(null)}
                onSaved={handleSaved}
              />
            )}

            {load.products.length === 0 ? (
              <div className="kh-status">
                <p className="kh-status-title">아직 등록한 상품이 없습니다</p>
              </div>
            ) : (
              <ul className="seller-product-list">
                {load.products.map((p) => (
                  <li key={p.id} className="seller-product-row">
                    <div className="seller-product-main">
                      <span className="shop-product-name">{p.name}</span>
                      <span className="seller-product-meta">
                        <span className="seller-num">{formatWon(p.price)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="seller-num">재고 {p.stock}</span>
                        <span className="shop-badge shop-badge-stock">
                          {PRODUCT_STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="kh-button kh-button-ghost"
                      onClick={() => {
                        setNotice(null);
                        setEditing({ mode: 'edit', product: p });
                      }}
                    >
                      수정
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ProductForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing: NonNullable<Editing>;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const creating = editing.mode === 'create';
  const [values, setValues] = useState<ProductFormValues>(
    creating ? EMPTY_PRODUCT_FORM : toForm(editing.product),
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = (key: keyof ProductFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = validateProductForm(values, creating);
    setErrors(next);
    setSaveError(null);
    if (Object.keys(next).length > 0) return;
    const body = {
      name: values.name.trim(),
      price: Number(values.price.trim()),
      brand: values.brand.trim() || null,
      category: values.category.trim() || null,
      description: values.description.trim() || null,
    };
    setSaving(true);
    try {
      if (editing.mode === 'create') {
        await createSellerProduct({ ...body, stock: Number(values.stock.trim()) });
        await onSaved('등록했습니다.');
      } else {
        await updateSellerProduct(editing.product.id, body);
        await onSaved('수정했습니다.');
      }
    } catch (err) {
      setSaveError(
        errorStatus(err) === 403
          ? '이 상품을 고칠 권한이 없습니다. 판매자 상태가 바뀌었을 수 있습니다.'
          : extractErrorMessage(err, '저장하지 못했습니다.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: keyof ProductFormValues,
    label: string,
    opts: { numeric?: boolean; maxLength?: number; multiline?: boolean } = {},
  ) => {
    const id = `seller-product-${key}`;
    const error = errors[key];
    const common = {
      id,
      className: 'kh-field',
      value: values[key],
      maxLength: opts.maxLength,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${id}-error` : undefined,
    } as const;
    return (
      <div className="seller-field">
        <label className="seller-label" htmlFor={id}>
          {label}
        </label>
        {opts.multiline ? (
          <textarea {...common} rows={3} onChange={(e) => update(key, e.target.value)} />
        ) : (
          <input
            {...common}
            type="text"
            inputMode={opts.numeric ? 'numeric' : undefined}
            onChange={(e) => update(key, e.target.value)}
          />
        )}
        {error && (
          <p className="seller-error" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form className="seller-panel seller-form" onSubmit={handleSubmit} noValidate>
      <p className="seller-panel-title">{creating ? '새 상품' : `상품 #${editing.product.id} 수정`}</p>
      {field('name', '상품명', { maxLength: 255 })}
      <div className="seller-field-row">
        {field('price', '가격(원)', { numeric: true, maxLength: 12 })}
        {creating && field('stock', '재고', { numeric: true, maxLength: 9 })}
      </div>
      {field('brand', '브랜드', { maxLength: 100 })}
      {field('category', '카테고리', { maxLength: 100 })}
      {field('description', '설명', { maxLength: 2000, multiline: true })}
      {!creating && <p className="seller-hint">재고는 등록할 때만 정하고 여기서는 바꾸지 않습니다.</p>}
      {saveError && (
        <div className="kh-status kh-status-error seller-submit-error" role="alert">
          {saveError}
        </div>
      )}
      <div className="seller-actions">
        <button type="button" className="kh-button kh-button-ghost" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="kh-button" disabled={saving}>
          {saving ? '저장 중…' : creating ? '등록' : '저장'}
        </button>
      </div>
    </form>
  );
}
