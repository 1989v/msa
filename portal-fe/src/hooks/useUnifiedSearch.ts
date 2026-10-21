import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { searchUnified, type UnifiedHit, type UnifiedResult } from '../api/unifiedSearchApi';

/** Shared launcher contract: all services, first match, IME-safe activation and latest response only. */
export function useUnifiedSearch(query: string, { all = false, page = 0, requestKey = '', nonce = 0 } = {}) {
  const key = JSON.stringify([query, all, page, requestKey, nonce]);
  const [response, setResponse] = useState<{ key: string; result: UnifiedResult } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const generation = useRef(0);
  const composing = useRef(false);
  const compositionEnded = useRef(0);
  const listId = useId();
  const result = !dismissed && response?.key === key ? response.result : null;
  const status = !query.trim() || dismissed ? 'idle' : result ? 'ready' : failedKey === key ? 'error' : 'loading';

  const invalidate = useCallback(() => {
    generation.current++;
    setResponse(null); setFailedKey(null); setSelected(0); setDismissed(false);
  }, []);
  const dismiss = () => {
    generation.current++;
    setResponse(null); setFailedKey(null); setSelected(0); setDismissed(true);
  };

  useEffect(() => {
    const version = ++generation.current;
    const abort = new AbortController();
    if (!query.trim() || dismissed) return () => abort.abort();
    const timer = window.setTimeout(() => {
      searchUnified(query.trim(), '', page, all, abort.signal).then(data => {
        if (version !== generation.current || abort.signal.aborted) return;
        setResponse({ key, result: data }); setFailedKey(null); setSelected(0);
      }).catch(() => {
        if (version !== generation.current || abort.signal.aborted) return;
        setFailedKey(key);
      });
    }, all ? 0 : 180);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [query, all, page, key, dismissed]);

  const activate = (open: (hit: UnifiedHit) => void) => {
    if (composing.current || Date.now() - compositionEnded.current < 60) return;
    if (status === 'ready' && result?.hits[selected]) open(result.hits[selected]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, open: (hit: UnifiedHit) => void, onEscape: () => void) => {
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) {
      // Some mobile browsers submit a form after an IME keydown without composition events.
      if (event.key === 'Enter' || event.keyCode === 229) compositionEnded.current = Date.now();
      // Escape belongs to the IME until composition finishes, not the enclosing dialog.
      if (event.key === 'Escape') event.stopPropagation();
      return;
    }
    if (event.key === 'Enter') { event.preventDefault(); activate(open); }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && result?.hits.length) {
      event.preventDefault();
      setSelected(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + result.hits.length) % result.hits.length);
    }
    if (event.key === 'Escape') onEscape();
  };
  const hitId = (index: number) => `${listId}-hit-${index}`;
  return {
    result, status, selected, setSelected, invalidate, dismiss, dismissed, activate, onKeyDown, listId, hitId,
    activeId: result?.hits[selected] ? hitId(selected) : undefined,
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: () => { composing.current = false; compositionEnded.current = Date.now(); },
  };
}
