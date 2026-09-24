import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adsErrorMessage,
  creditsToMicros,
  formatCredits,
  isDefinitiveRejection,
  newIdempotencyKey,
  topUp,
  type AdvertiserDashboard,
} from '../../api/adsConsoleApi';
import { CreditNote } from './consoleParts';
import { consoleHref, topUpHeadroomMicros } from './consoleView';

interface TopUpAttempt {
  micros: number;
  key: string;
}

/**
 * 셀프 충전. 서버는 같은 멱등 키의 요청을 한 거래로 본다. 키는 성공이나 확정 거절(4xx)을 받을 때까지 유지한다 —
 * 시간 초과·네트워크 오류는 서버에 기록됐을 수 있어서, 새 키로 다시 보내면 두 번 충전된다.
 * 결과를 모르는 시도가 남아 있는 동안에는 금액을 잠근다. 같은 키에 다른 금액을 보내면 서버는 앞 거래를 돌려준다.
 * 1회 상한·하루 합계 한도는 서버가 지갑 잠금 안에서 확인하고, 넘으면 그 문구를 그대로 보여 준다.
 */
export default function TopUpForm({ advertiser, readOnly }: { advertiser: AdvertiserDashboard; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // 결과를 모르는 충전 시도. 다시 누르면 같은 키·같은 금액으로 보낸다.
  const [unconfirmed, setUnconfirmed] = useState<TopUpAttempt | null>(null);

  const mutation = useMutation({
    mutationFn: ({ micros, key }: TopUpAttempt) => topUp(micros, key),
    onSuccess: (result) => {
      setUnconfirmed(null);
      setError(null);
      setDone(`충전했습니다. 잔액 ${formatCredits(result.balanceMicros)} 크레딧`);
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['ads', 'me'] });
    },
    onError: (err, attempt) => {
      setDone(null);
      if (isDefinitiveRejection(err)) {
        setUnconfirmed(null);
        setError(adsErrorMessage(err, '충전하지 못했습니다.'));
      } else {
        setUnconfirmed(attempt);
        setError('충전 결과를 확인하지 못했습니다. 다시 누르면 같은 요청으로 보내 한 번만 충전됩니다.');
      }
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (unconfirmed) {
      mutation.mutate(unconfirmed);
      return;
    }
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
              readOnly={unconfirmed != null}
              placeholder="예: 50"
              aria-describedby="adc-topup-hint"
            />
          </label>
          <p className="adc-hint" id="adc-topup-hint">
            <CreditNote /> 오늘 충전 가능 {formatCredits(topUpHeadroomMicros(advertiser))} /{' '}
            {formatCredits(advertiser.dailyTopUpLimitMicros)} 크레딧 · 1회 최대 {formatCredits(advertiser.maxTopUpPerCallMicros)}{' '}
            크레딧. 하루는 KST 기준입니다.
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
