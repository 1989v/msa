import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, UNSAFE_NavigationContext } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rankingGet, rankingWrite, type Evidence, type Operation, type Page } from '@/api/ranking';

export function kst(value: string | null) { return value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST' : '—'; }
export function cell(value: unknown) { return value == null || value === '' ? '미확정' : String(value); }
export const FIELD_LABEL: Record<string, string> = { displayName: '표시명', drinkGroup: '유형', adminNote: '운영 메모', volumeMl: '용량(ml)', kcal: '열량(kcal)', sugarG: '당류(g)', caffeineMg: '카페인(mg)', sodiumMg: '나트륨(mg)', carbsG: '탄수화물(g)', fatG: '지방(g)', satFatG: '포화지방(g)', proteinG: '단백질(g)', sourceUrl: '행 근거 URL', checkedAt: '행 확인일' };
export const SELECT = 'h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm';
export function forbidden() { window.dispatchEvent(new Event('ranking-admin-forbidden')); }
export function useRanking<T>(path: string, params?: URLSearchParams) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const sequence = useRef(0); const query = params?.toString() ?? '';
  const reload = useCallback(async (): Promise<T | null> => {
    const request = ++sequence.current; setLoading(true); setError('');
    try { const value = await rankingGet<T>(path, new URLSearchParams(query)); if (sequence.current === request) setData(value); return value; }
    catch (e) { if (sequence.current === request) { if (axios.isAxiosError(e) && [401, 403].includes(e.response?.status ?? 0)) { setData(null); if (e.response?.status === 403) forbidden(); } setError(errorMessage(e)); } return null; }
    finally { if (sequence.current === request) setLoading(false); }
  }, [path, query]);
  useEffect(() => { void reload(); return () => { sequence.current++; }; }, [reload]);
  return { data, error, loading, reload };
}
export function fieldFailure(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return {};
  const code = error.response?.data?.error?.code as string | undefined;
  const field = code?.startsWith('INVALID_FIELD_') ? code.slice('INVALID_FIELD_'.length) : null;
  if (!field) return {};
  document.querySelector<HTMLElement>(`[data-ranking-field="${field}"]`)?.focus();
  return { [field]: error.response?.data?.error?.message ?? '입력값을 확인하세요' };
}
export function FieldErrors({ errors }: { errors: Record<string, string> }) { return <>{Object.entries(errors).map(([field, message]) => <p role="alert" key={field}><a href="#" className="underline" onClick={event => { event.preventDefault(); document.querySelector<HTMLElement>(`[data-ranking-field="${field}"]`)?.focus(); }}>{FIELD_LABEL[field] ?? field}: {message}</a></p>)}</>; }
export function errorMessage(e: unknown) {
  const status = axios.isAxiosError(e) ? e.response?.status : null;
  if (status === 403) return '관리자 권한이 필요합니다';
  if (status === 409) return '다른 수정 또는 새 적재가 반영되었습니다. 입력은 보존됩니다. 최신값을 다시 조회하세요.';
  if (status === 404) return '원천 행을 찾을 수 없음 · 보관기간 경과 또는 자료 없음';
  if (status === 400) return '입력값·사유·https 근거 URL·확인일을 확인하세요.';
  return '불러오지 못했습니다. 다시 시도하세요.';
}
export function Status({ error, loading, reload }: { error: string; loading: boolean; reload: () => unknown }) {
  if (error.includes('관리자 권한')) return <p role="alert">{error} <Link to="/unauthorized">권한 안내</Link></p>;
  return <div aria-live="polite">{error ? <p role="alert">{error} <Button variant="outline" size="sm" onClick={() => reload()}>다시 조회</Button></p> : loading ? <p>불러오는 중…</p> : null}</div>;
}
export function Pager({ page, total, size, move }: { page: number; total: number; size: number; move: (p: number) => void }) {
  return <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>전체 {total}행 · {page + 1} / {Math.max(1, Math.ceil(total / size))}</span><Button size="sm" variant="outline" disabled={page === 0} onClick={() => move(page - 1)}>이전</Button><Button size="sm" variant="outline" disabled={(page + 1) * size >= total} onClick={() => move(page + 1)}>다음</Button></div>;
}
export function EvidenceFields({ value, change }: { value: Evidence; change: (e: Evidence) => void }) {
  return <fieldset className="grid gap-3 sm:grid-cols-3"><legend className="mb-2 font-medium">변경 사유와 공식 근거</legend><label className="text-sm">사유*<Input required maxLength={2000} data-ranking-field="reason" value={value.reason} onChange={e => change({ ...value, reason: e.target.value })} /></label><label className="text-sm">근거 URL*<Input required type="url" pattern="https://.*" data-ranking-field="evidenceUrl" value={value.evidenceUrl} onChange={e => change({ ...value, evidenceUrl: e.target.value })} /></label><label className="text-sm">확인일*<Input required type="date" max={new Date().toISOString().slice(0, 10)} data-ranking-field="evidenceCheckedAt" value={value.evidenceCheckedAt} onChange={e => change({ ...value, evidenceCheckedAt: e.target.value })} /></label></fieldset>;
}
export const EMPTY_EVIDENCE: Evidence = { reason: '', evidenceUrl: '', evidenceCheckedAt: '' };
/** Keep the exact attempted payload and UUID in memory until a definitive response. */
export function useOperation(onSuccess: () => unknown) {
  const [status, setStatus] = useState<number | null>(null); const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [unknown, setUnknown] = useState(false); const [result, setResult] = useState<Operation | null>(null);
  const pending = useRef<{ method: 'post' | 'patch'; path: string; payload: object & { idempotencyKey: string } } | null>(null);
  const submit = async (method: 'post' | 'patch', path: string, payload: object, retry = false) => {
    if (busy) return;
    if (!retry) pending.current = { method, path, payload: { ...payload, idempotencyKey: crypto.randomUUID() } };
    const job = pending.current; if (!job) return;
    setBusy(true); setMessage(''); setFieldErrors({}); setStatus(null);
    try {
      const op = await rankingWrite<Operation>(job.method, job.path, job.payload);
      setResult(op); setUnknown(false); pending.current = null; setMessage(`${op.changed}행 저장 · ${kst(op.at)} · ${op.operationId}`); await onSuccess();
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      setStatus(status ?? null);
      if (status === 403) forbidden();
      if (status === 400) setFieldErrors(fieldFailure(e));
      if (!status || status >= 500) {
        try { const op = await rankingGet<Operation>(`operations/${job.payload.idempotencyKey}`); setResult(op); setUnknown(false); pending.current = null; setMessage(`처리 확인: ${op.changed}행 · ${op.operationId}`); await onSuccess(); }
        catch (recoveryError) {
          if (axios.isAxiosError(recoveryError) && recoveryError.response?.status === 403) {
            pending.current = null; setUnknown(false); setStatus(403); setMessage(errorMessage(recoveryError)); forbidden();
          } else { setUnknown(true); setMessage(`처리 결과 확인 중 · ${job.payload.idempotencyKey}. 같은 키·본문으로 재시도할 수 있습니다.`); }
        }
      } else { setUnknown(false); pending.current = null; setMessage(errorMessage(e)); }
    } finally { setBusy(false); }
  };
  return { busy, unknown, result, submit, message, status, fieldErrors, acceptLatest: () => { setStatus(null); setMessage('최신 기준을 불러왔습니다. 초안을 검토한 뒤 다시 저장하세요.'); }, retry: () => submit('post', '', {}, true) };
}
export function OperationStatus({ op }: { op: ReturnType<typeof useOperation> }) { return <div aria-live="polite" className="break-all text-sm">{op.message}{Object.entries(op.fieldErrors).map(([field, message]) => <p role="alert" key={field}><a className="underline" href="#" onClick={e => { e.preventDefault(); document.querySelector<HTMLElement>(`[data-ranking-field="${field}"]`)?.focus(); }}>{FIELD_LABEL[field] ?? field}: {message}</a></p>)}{op.unknown && <Button disabled={op.busy} variant="outline" onClick={op.retry}>같은 요청 결과 확인·재시도</Button>}{op.result && <Link className="ml-3 underline" to={`/ranking/audit?operationId=${op.result.operationId}`}>감사·되돌리기 검토</Link>}</div>; }
export function Empty({ data, error, loading }: { data: Page<unknown> | null; error: string; loading: boolean }) { return !error && !loading && data?.total === 0 ? <p className="py-6 text-sm">조건에 맞는 데이터 없음 · 저장된 원천 또는 이력이 없을 수 있습니다.</p> : null; }
const DirtyContext = createContext<(id: string, value: boolean) => void>(() => {});
/** Guard router push/replace/go, browser history, tab close, and ordinary links. */
export function DirtyNavigation({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState<Record<string, boolean>>({}); const [pending, setPending] = useState<(() => void) | null>(null);
  const { navigator } = useContext(UNSAFE_NavigationContext); const restoring = useRef(false);
  const mark = useCallback((id: string, value: boolean) => setDirty(previous => previous[id] === value ? previous : { ...previous, [id]: value }), []);
  const hasDirty = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!hasDirty) return;
    const push = navigator.push.bind(navigator), replace = navigator.replace.bind(navigator), go = navigator.go.bind(navigator);
    const guardedPush: typeof navigator.push = (...args) => { setPending(() => () => push(...args)); };
    const guardedReplace: typeof navigator.replace = (...args) => { setPending(() => () => replace(...args)); };
    const guardedGo: typeof navigator.go = (...args) => { setPending(() => () => go(...args)); };
    navigator.push = guardedPush; navigator.replace = guardedReplace; navigator.go = guardedGo;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const currentIndex = window.history.state?.idx as number | undefined;
    const pop = (event: PopStateEvent) => {
      if (restoring.current) { restoring.current = false; return; }
      const nextIndex = event.state?.idx as number | undefined;
      if (currentIndex !== undefined && nextIndex !== undefined && currentIndex !== nextIndex) {
        event.stopImmediatePropagation(); restoring.current = true; go(currentIndex - nextIndex);
        setPending(() => () => go(nextIndex - currentIndex));
      }
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hash === '#' || anchor.getAttribute('href') === '#') return;
      if (anchor.origin !== window.location.origin) { event.preventDefault(); event.stopImmediatePropagation(); setPending(() => () => window.location.assign(anchor.href)); }
    };
    window.addEventListener('beforeunload', unload); window.addEventListener('popstate', pop, true); document.addEventListener('click', click, true);
    return () => { navigator.push = push; navigator.replace = replace; navigator.go = go; window.removeEventListener('beforeunload', unload); window.removeEventListener('popstate', pop, true); document.removeEventListener('click', click, true); };
  }, [hasDirty, navigator]);
  return <DirtyContext.Provider value={mark}><div inert={pending ? true : undefined}>{children}</div>{pending && <div role="dialog" aria-modal="true" aria-label="미저장 변경" className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6"><div className="space-y-4 rounded-md border border-border bg-background p-6"><h2 className="font-semibold">미저장 변경</h2><p>이동하면 입력한 변경이 사라집니다.</p><Button autoFocus variant="outline" onClick={() => setPending(null)}>편집 계속</Button><Button className="ml-3" onClick={() => { const action = pending; setDirty({}); setPending(null); action(); }}>변경 버리고 이동</Button></div></div>}</DirtyContext.Provider>;
}
export function useUnsaved(dirty: boolean) {
  const mark = useContext(DirtyContext); const id = useId();
  useEffect(() => { mark(id, dirty); return () => mark(id, false); }, [dirty, id, mark]);
}
