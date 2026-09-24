import type { ApplySellerRequest, SellerStatus, SettlementCycle } from '../../api/shopApi';

/** 입력 중인 값은 문자열로 둔다 — 숫자 칸도 사용자가 친 그대로 검증해야 오류를 보여줄 수 있다 */
export interface ApplyFormValues {
  businessName: string;
  businessRegistrationNo: string;
  representativeName: string;
  bankName: string;
  accountNumber: string;
  shippingFee: string;
  settlementCycle: SettlementCycle | '';
}

export type ApplyFormErrors = Partial<Record<keyof ApplyFormValues, string>>;

export const EMPTY_APPLY_FORM: ApplyFormValues = {
  businessName: '',
  businessRegistrationNo: '',
  representativeName: '',
  bankName: '',
  accountNumber: '',
  shippingFee: '',
  settlementCycle: '',
};

export const SELLER_STATUS_LABEL: Record<SellerStatus, string> = {
  PENDING: '심사 중',
  ACTIVE: '승인됨',
  SUSPENDED: '정지됨',
  REJECTED: '반려됨',
};

export const SETTLEMENT_CYCLE_LABEL: Record<SettlementCycle, string> = {
  WEEKLY: '매주',
  MONTHLY: '매월',
};

// 서버 규칙과 같은 모양 — 사업자번호 숫자 10자리(Seller.BRN), 계좌 숫자 6~20자리(AccountNumber)
const BRN = /^\d{10}$/;
const ACCOUNT = /^\d{6,20}$/;
const WON = /^\d+$/;

const stripSeparators = (v: string) => v.replace(/[-\s]/g, '');

/** 오류가 하나도 없을 때만 서버에 보낼 요청을 만든다 */
export function validateApplyForm(v: ApplyFormValues): {
  errors: ApplyFormErrors;
  request: ApplySellerRequest | null;
} {
  const errors: ApplyFormErrors = {};
  const brn = stripSeparators(v.businessRegistrationNo);
  const account = stripSeparators(v.accountNumber);
  const fee = v.shippingFee.trim();

  if (!v.businessName.trim()) errors.businessName = '상호를 입력해 주세요.';
  if (!brn) errors.businessRegistrationNo = '사업자등록번호를 입력해 주세요.';
  else if (!BRN.test(brn)) errors.businessRegistrationNo = '사업자등록번호는 숫자 10자리입니다.';
  if (!v.representativeName.trim()) errors.representativeName = '대표자명을 입력해 주세요.';
  if (!v.bankName.trim()) errors.bankName = '은행을 입력해 주세요.';
  if (!account) errors.accountNumber = '계좌번호를 입력해 주세요.';
  else if (!ACCOUNT.test(account)) errors.accountNumber = '계좌번호는 숫자 6~20자리입니다.';
  if (!fee) errors.shippingFee = '배송비를 입력해 주세요. 무료 배송이면 0 입니다.';
  else if (!WON.test(fee)) errors.shippingFee = '배송비는 0 이상의 숫자(원)만 입력합니다.';
  if (!v.settlementCycle) errors.settlementCycle = '정산 주기를 골라 주세요.';

  if (Object.keys(errors).length > 0 || !v.settlementCycle) return { errors, request: null };
  return {
    errors,
    request: {
      businessName: v.businessName.trim(),
      businessRegistrationNo: brn,
      representativeName: v.representativeName.trim(),
      bankName: v.bankName.trim(),
      accountNumber: account,
      shippingFee: Number(fee),
      settlementCycle: v.settlementCycle,
    },
  };
}

// ── 상품 등록·수정 ─────────────────────────────────────────────

export interface ProductFormValues {
  name: string;
  price: string;
  stock: string;
  brand: string;
  category: string;
  description: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: '',
  price: '',
  stock: '',
  brand: '',
  category: '',
  description: '',
};

/** `creating` 이 false 면 재고를 보지 않는다 — 수정 API 가 재고를 받지 않는다 */
export function validateProductForm(v: ProductFormValues, creating: boolean): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!v.name.trim()) errors.name = '상품명을 입력해 주세요.';
  else if (v.name.trim().length > 255) errors.name = '상품명은 255자 이하입니다.';
  const price = v.price.trim();
  if (!WON.test(price) || Number(price) <= 0) errors.price = '가격은 1원 이상의 숫자입니다.';
  if (creating && !WON.test(v.stock.trim())) errors.stock = '재고는 0 이상의 숫자입니다.';
  if (v.brand.length > 100) errors.brand = '브랜드는 100자 이하입니다.';
  if (v.category.length > 100) errors.category = '카테고리는 100자 이하입니다.';
  if (v.description.length > 2000) errors.description = '설명은 2000자 이하입니다.';
  return errors;
}
