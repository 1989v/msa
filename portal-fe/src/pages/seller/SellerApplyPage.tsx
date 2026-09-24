import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ShopHeader from '../../components/ShopHeader';
import { portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import {
  applySeller,
  errorStatus,
  extractErrorMessage,
  fetchMySellerApplication,
  type SellerApplication,
  type SettlementCycle,
} from '../../api/shopApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import SellerApplicationPanel from './SellerApplicationPanel';
import {
  EMPTY_APPLY_FORM,
  SETTLEMENT_CYCLE_LABEL,
  validateApplyForm,
  type ApplyFormErrors,
  type ApplyFormValues,
} from './sellerForm';
import '../Shop.css';
import './Seller.css';

type TextField = Exclude<keyof ApplyFormValues, 'settlementCycle'>;

interface FieldSpec {
  key: TextField;
  label: string;
  hint?: string;
  inputMode?: 'numeric' | 'text';
  autoComplete?: string;
  maxLength: number;
}

// maxLength 는 서버 요청 검증(@Size)과 같은 값
const BUSINESS_FIELDS: FieldSpec[] = [
  { key: 'businessName', label: '상호', maxLength: 100, autoComplete: 'organization' },
  {
    key: 'businessRegistrationNo',
    label: '사업자등록번호',
    hint: '숫자 10자리 · 하이픈은 있어도 됩니다',
    inputMode: 'numeric',
    maxLength: 20,
  },
  { key: 'representativeName', label: '대표자명', maxLength: 50, autoComplete: 'name' },
];

const SETTLEMENT_FIELDS: FieldSpec[] = [
  { key: 'bankName', label: '은행', maxLength: 50 },
  {
    key: 'accountNumber',
    label: '정산 계좌번호',
    hint: '숫자 6~20자리 · 저장할 때 암호화하고 화면에는 끝 4자리만 보입니다',
    inputMode: 'numeric',
    maxLength: 30,
  },
];

const CYCLES: SettlementCycle[] = ['WEEKLY', 'MONTHLY'];

/**
 * 입점 신청. 수수료율은 받지 않는다 — 어드민이 승인하면서 정한다.
 * 열린 신청(심사 중·승인·정지)이 있으면 폼 대신 그 상태를 보여 준다. 반려면 사유를 위에 두고 폼을 연다.
 */
export default function SellerApplyPage() {
  useHeritageSurface();
  useSeo({ title: portalTitle('입점 신청'), canonical: portalUrl('/shop/seller/apply'), noindex: true });

  const [values, setValues] = useState<ApplyFormValues>(EMPTY_APPLY_FORM);
  const [errors, setErrors] = useState<ApplyFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // undefined = 아직 모름(조회 중·조회 실패) — 폼은 연다. 서버가 1인 1판매자를 다시 막는다
  const [existing, setExisting] = useState<SellerApplication | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.replace(buildLoginHref('/shop/seller/apply'));
      return;
    }
    let cancelled = false;
    fetchMySellerApplication()
      .then((application) => {
        if (!cancelled) setExisting(application);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key: keyof ApplyFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { errors: next, request } = validateApplyForm(values);
    setErrors(next);
    setSubmitError(null);
    if (!request) return;
    setSubmitting(true);
    try {
      const created = await applySeller(request);
      setExisting({ ...created, suspendReason: null });
    } catch (err) {
      setSubmitError(
        errorStatus(err) === 409
          ? '이미 심사 중이거나 등록된 판매자입니다. 정지된 판매자는 새로 신청할 수 없습니다.'
          : extractErrorMessage(err, '신청을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f: FieldSpec) => {
    const id = `seller-apply-${f.key}`;
    const error = errors[f.key];
    const describedBy = [f.hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ');
    return (
      <div className="seller-field" key={f.key}>
        <label className="seller-label" htmlFor={id}>
          {f.label}
        </label>
        <input
          id={id}
          className="kh-field"
          type="text"
          value={values[f.key]}
          inputMode={f.inputMode}
          autoComplete={f.autoComplete ?? 'off'}
          maxLength={f.maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => update(f.key, e.target.value)}
        />
        {f.hint && (
          <p className="seller-hint" id={`${id}-hint`}>
            {f.hint}
          </p>
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
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container seller-container">
        <header className="seller-head">
          <span className="kh-section-label">Seller</span>
          <h1 className="shop-page-title">입점 신청</h1>
          <p className="seller-lead">
            심사를 거쳐 승인되면 상품을 등록할 수 있습니다. 수수료율은 승인할 때 정해 알려
            드립니다.
          </p>
        </header>

        {existing && <SellerApplicationPanel application={existing} showActions={existing.status !== 'REJECTED'} />}

        {(!existing || existing.status === 'REJECTED') && (
          <form className="seller-form" onSubmit={handleSubmit} noValidate>
            <fieldset className="seller-fieldset">
              <legend className="kh-section-head seller-legend">
                <span className="kh-index seller-num">01_</span>사업자 정보
              </legend>
              {BUSINESS_FIELDS.map(renderField)}
            </fieldset>

            <fieldset className="seller-fieldset">
              <legend className="kh-section-head seller-legend">
                <span className="kh-index seller-num">02_</span>정산
              </legend>
              {SETTLEMENT_FIELDS.map(renderField)}
              <div className="seller-field">
                <span className="seller-label" id="seller-apply-cycle-label">
                  정산 주기
                </span>
                <div
                  className="seller-choices"
                  role="radiogroup"
                  aria-labelledby="seller-apply-cycle-label"
                  aria-describedby={errors.settlementCycle ? 'seller-apply-cycle-error' : undefined}
                >
                  {CYCLES.map((c) => (
                    <label key={c} className="seller-choice">
                      <input
                        type="radio"
                        name="settlementCycle"
                        value={c}
                        checked={values.settlementCycle === c}
                        onChange={() => update('settlementCycle', c)}
                      />
                      <span>{SETTLEMENT_CYCLE_LABEL[c]}</span>
                    </label>
                  ))}
                </div>
                {errors.settlementCycle && (
                  <p className="seller-error" id="seller-apply-cycle-error" role="alert">
                    {errors.settlementCycle}
                  </p>
                )}
              </div>
            </fieldset>

            <fieldset className="seller-fieldset">
              <legend className="kh-section-head seller-legend">
                <span className="kh-index seller-num">03_</span>배송
              </legend>
              {renderField({
                key: 'shippingFee',
                label: '배송비(원)',
                hint: '주문마다 한 번 붙는 고정 배송비 · 무료면 0',
                inputMode: 'numeric',
                maxLength: 9,
              })}
            </fieldset>

            <p className="seller-note">
              입력한 사업자 정보와 계좌는 정산에만 씁니다. 보관 기간은{' '}
              <Link to="/privacy">개인정보처리방침</Link> 6항에 있습니다.
            </p>

            {submitError && (
              <div className="kh-status kh-status-error seller-submit-error" role="alert">
                {submitError}
              </div>
            )}

            <button type="submit" className="kh-button seller-submit" disabled={submitting}>
              {submitting ? '보내는 중…' : '신청하기'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
