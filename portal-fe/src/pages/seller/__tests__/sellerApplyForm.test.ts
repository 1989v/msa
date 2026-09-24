import { describe, expect, it } from 'vitest';
import { EMPTY_APPLY_FORM, validateApplyForm } from '../sellerForm';

const filled = {
  businessName: '한지상회',
  businessRegistrationNo: '123-45-67890',
  representativeName: '홍길동',
  bankName: '국민은행',
  accountNumber: '123456-01-234567',
  shippingFee: '3000',
  settlementCycle: 'WEEKLY' as const,
};

describe('입점 신청 폼 검증', () => {
  it('빈 폼은 요청을 만들지 않고 필수 항목마다 오류를 낸다', () => {
    const { errors, request } = validateApplyForm(EMPTY_APPLY_FORM);
    expect(request).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(
      [
        'accountNumber',
        'bankName',
        'businessName',
        'businessRegistrationNo',
        'representativeName',
        'settlementCycle',
        'shippingFee',
      ].sort(),
    );
  });

  it('계좌·배송비는 숫자만, 사업자번호는 10자리 — 하이픈은 지우고 서버 계약 모양으로 보낸다', () => {
    expect(validateApplyForm({ ...filled, accountNumber: '12ab5678' }).errors.accountNumber).toBeDefined();
    expect(validateApplyForm({ ...filled, accountNumber: '12345' }).errors.accountNumber).toBeDefined();
    expect(validateApplyForm({ ...filled, shippingFee: '3,000원' }).errors.shippingFee).toBeDefined();
    expect(validateApplyForm({ ...filled, shippingFee: '-1' }).errors.shippingFee).toBeDefined();
    expect(validateApplyForm({ ...filled, businessRegistrationNo: '123-45-6789' }).errors.businessRegistrationNo).toBeDefined();

    const { errors, request } = validateApplyForm(filled);
    expect(errors).toEqual({});
    expect(request).toEqual({
      businessName: '한지상회',
      businessRegistrationNo: '1234567890',
      representativeName: '홍길동',
      bankName: '국민은행',
      accountNumber: '12345601234567',
      shippingFee: 3000,
      settlementCycle: 'WEEKLY',
    });
  });
});
