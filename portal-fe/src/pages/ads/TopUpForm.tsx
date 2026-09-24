import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adsErrorMessage,
  creditsToMicros,
  formatCredits,
  newIdempotencyKey,
  topUp,
  type AdvertiserDashboard,
} from '../../api/adsConsoleApi';
import { CreditNote } from './consoleParts';
import { consoleHref } from './consoleView';

/**
 * 셀프 충전. 제출마다 멱등 키를 새로 만든다 — 서버는 같은 키의 요청을 한 거래로 본다.
 * 1회 상한·하루 합계 한도는 서버가 지갑 잠금 안에서 확인하고, 넘으면 그 문구를 그대로 보여 준다.
 */
export default function TopUpForm({ advertiser, readOnly }: { advertiser: AdvertiserDashboard; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ micros, key }: { micros: number; key: string }) => topUp(micros, key),
    onSuccess: (result) => {
      setError(null);
      setDone(`충전했습니다. 잔액 ${formatCredits(result.balanceMicros)} 크레딧`);
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['ads', 'me'] });
    },
    onError: (err) => {
      setDone(null);
      setError(adsErrorMessage(err, '충전하지 못했습니다.'));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const micros = creditsToMicros(amount);
    if (micros == null || micros <= 0) {
      setDone(null);
      setError('충전할 크레딧을 숫자로 적어 주세요.');
      return;
    }
    mutation.mutate({ micros, key: newIdempotencyKey() });
  };

  return (
    <section className="adc-section adc-narrow">
      <div className="adc-section__head">
        <h1>크레딧 충전</h1>
        <Link className="adc-link" to={consoleHref('')}>
          대시보드로
        </Link>
      </div>
      <p className="adc-lede">
        지금 잔액 <strong className="adc-num">{formatCredits(advertiser.balanceMicros)}</strong> 크레딧 <CreditNote />
      </p>
      {readOnly ? (
        <p className="adc-status">정지된 광고주는 충전할 수 없습니다.</p>
      ) : (
        <form className="adc-form" onSubmit={onSubmit}>
          <label className="adc-field">
            <span className="adc-field__label">충전할 크레딧</span>
            <input
              className="kh-field adc-num"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 50"
              aria-describedby="adc-topup-hint"
            />
          </label>
          <p className="adc-hint" id="adc-topup-hint">
            <CreditNote /> 1회 상한과 하루(KST) 합계 한도가 있습니다.
          </p>
          {error && (
            <p className="adc-error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="adc-done" role="status">
              {done}
            </p>
          )}
          <button className="adc-btn" type="submit" disabled={mutation.isPending}>
            충전
          </button>
        </form>
      )}
    </section>
  );
}
