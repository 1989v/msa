import { promptDomains, promptTags, type PromptContent } from '../../api/peerPromptsApi';

export const PEER_DRAFT_KEY = 'peer-prompt-draft-v1';
export interface PeerDraft { version: 1; revision: string; content: PromptContent; displayName: string; step: 'edit' | 'preview' }
export const emptyPromptContent = (): PromptContent => ({ domain: 'SOFTWARE', title: '', purpose: '', modelContext: '', promptText: '', tags: [] });
export const draftRevision = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const newPeerDraft = (content = emptyPromptContent()): PeerDraft => ({ version: 1, revision: draftRevision(), content, displayName: '', step: 'edit' });
export function hasDraftContent(draft: PeerDraft): boolean {
  return !!(draft.content.domain !== 'SOFTWARE' || draft.displayName || draft.content.title || draft.content.purpose || draft.content.modelContext || draft.content.promptText || draft.content.tags?.length);
}
export function readPeerDraft(): PeerDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PEER_DRAFT_KEY) ?? 'null');
    if (!value || value.version !== 1 || typeof value.revision !== 'string' || !value.content || typeof value.displayName !== 'string') return null;
    const content = value.content;
    if (!(content.domain in promptDomains) || !['title', 'purpose', 'modelContext', 'promptText'].every(key => typeof content[key] === 'string')) return null;
    if (content.tags != null && (!Array.isArray(content.tags) || content.tags.length > 3 || content.tags.some((tag: unknown) => typeof tag !== 'string' || !(tag in promptTags)))) return null;
    return { ...value, step: value.step === 'preview' ? 'preview' : 'edit', content: { ...content, tags: content.tags ?? [] } };
  } catch { return null; }
}
export function savePeerDraft(draft: PeerDraft, expectedRevision: string | null): 'saved' | 'conflict' | 'unavailable' {
  try {
    const raw = sessionStorage.getItem(PEER_DRAFT_KEY);
    if (raw != null && readPeerDraft()?.revision !== expectedRevision) return 'conflict';
    if (raw == null && expectedRevision != null) return 'conflict';
    sessionStorage.setItem(PEER_DRAFT_KEY, JSON.stringify(draft));
    return 'saved';
  } catch { return 'unavailable'; }
}
export function clearPeerDraft(expectedRevision: string): boolean {
  try {
    if (readPeerDraft()?.revision !== expectedRevision) return false;
    sessionStorage.removeItem(PEER_DRAFT_KEY);
    return true;
  } catch { return false; }
}

export type DraftErrors = Partial<Record<keyof PromptContent | 'displayName', string>>;
export function validatePeerDraft(draft: PeerDraft): DraftErrors {
  const errors: DraftErrors = {};
  const fields = [['title', 160, '제목'], ['purpose', 1000, '업무 목적'], ['modelContext', 2000, '모델·사용 맥락'], ['promptText', 30000, '프롬프트 원문']] as const;
  for (const [key, max, label] of fields) {
    if (!draft.content[key].trim()) errors[key] = `${label}을 입력해 주세요.`;
    else if (draft.content[key].length > max) errors[key] = `${max.toLocaleString()}자 이내로 입력해 주세요.`;
  }
  if (!draft.displayName.trim() || draft.displayName.length > 40) errors.displayName = '표시 이름을 1~40자로 입력해 주세요.';
  if ((draft.content.tags?.length ?? 0) > 3) errors.tags = '업무 태그는 최대 3개 선택해 주세요.';
  return errors;
}
