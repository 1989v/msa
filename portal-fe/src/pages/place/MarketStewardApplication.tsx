import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildLoginHref, getUserId, isLoggedIn } from '../../auth/auth';
import { applySteward, currentSteward } from '../../api/marketStewardApi';
import { applicationErrors, managePath, stewardError, stewardScreen } from './stewardState';

export default function MarketStewardApplication({ marketId, lang }: { marketId: number; lang: 'ko' | 'en' }) {
  const loggedIn = isLoggedIn();
  const client = useQueryClient();
  const key = ['market-steward', marketId, getUserId()];
  const query = useQuery({ queryKey: key, queryFn: () => currentSteward(marketId), enabled: loggedIn, retry: false, staleTime: 0 });
  const [org, setOrg] = useState(''); const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [submitted, setSubmitted] = useState(false);
  const errors = applicationErrors(org, contact);
  const mode = stewardScreen(query.data?.status ?? null);
  return <section className="market-steward" aria-label="상인회 담당자 신청">
    <h3>상인회 담당자 신청</h3>
    {!loggedIn ? <a href={buildLoginHref()}>상인회 담당자 신청</a> : query.isPending ? <p role="status">신청 상태를 확인하는 중…</p> : query.isError ? <p role="alert">{stewardError(query.error)} <a href={buildLoginHref()}>다시 로그인</a> <button onClick={() => void query.refetch()}>다시 불러오기</button></p> : mode === 'manage' ? <a href={managePath(marketId, lang)}>가게 정보 관리</a> : mode === 'pending' ? <p role="status">승인 대기</p> : mode === 'suspended' ? <p role="status">정지됨 — 운영자 문의</p> : <form noValidate onSubmit={async e => { e.preventDefault(); setSubmitted(true); if (errors.orgName || errors.contact || busy) return; setBusy(true); setError(''); try { client.setQueryData(key, await applySteward(marketId, org, contact)); } catch (err) { setError(stewardError(err)); } finally { setBusy(false); } }}>
      {query.data?.status === 'REJECTED' && <p>반려된 신청입니다. 단체명과 연락처를 확인하여 다시 신청하세요.</p>}
      <label htmlFor={`steward-org-${marketId}`}>단체명 (필수)</label><input id={`steward-org-${marketId}`} autoComplete="organization" maxLength={300} value={org} onChange={e => setOrg(e.target.value)} aria-invalid={submitted && !!errors.orgName} aria-describedby={`steward-org-error-${marketId}`} />
      <p id={`steward-org-error-${marketId}`}>{submitted && errors.orgName}</p>
      <label htmlFor={`steward-contact-${marketId}`}>연락처 (필수)</label><input id={`steward-contact-${marketId}`} maxLength={500} value={contact} onChange={e => setContact(e.target.value)} aria-invalid={submitted && !!errors.contact} aria-describedby={`steward-contact-error-${marketId}`} />
      <p id={`steward-contact-error-${marketId}`}>{submitted && errors.contact}</p><p>운영자가 연락처로 확인한 뒤 승인합니다.</p>
      {error && <p role="alert">{error} <a href={buildLoginHref()}>다시 로그인</a></p>}<button disabled={busy} type="submit">{busy ? '신청 중…' : '담당자 신청하기'}</button>
    </form>}
  </section>;
}
