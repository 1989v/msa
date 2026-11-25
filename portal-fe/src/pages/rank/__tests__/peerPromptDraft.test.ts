import { beforeEach, expect, it, vi } from 'vitest';
import { clearPeerDraft, hasDraftContent, newPeerDraft, PEER_DRAFT_KEY, readPeerDraft, savePeerDraft } from '../peerPromptDraft';

beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

it('refuses to overwrite or clear a newer draft from another mounted editor', () => {
  const first = newPeerDraft(); first.content.title = '최초 초안';
  expect(savePeerDraft(first, null)).toBe('saved');
  const newer = { ...first, revision: 'newer', content: { ...first.content, title: '다른 화면에서 바꾼 초안' } };
  expect(savePeerDraft(newer, first.revision)).toBe('saved');
  expect(savePeerDraft({ ...first, revision: 'stale' }, first.revision)).toBe('conflict');
  expect(clearPeerDraft(first.revision)).toBe(false);
  expect(readPeerDraft()?.content.title).toBe('다른 화면에서 바꾼 초안');
});

it('does not silently replace unreadable existing storage', () => {
  sessionStorage.setItem(PEER_DRAFT_KEY, 'unreadable');
  expect(readPeerDraft()).toBeNull();
  expect(savePeerDraft(newPeerDraft(), null)).toBe('conflict');
  expect(sessionStorage.getItem(PEER_DRAFT_KEY)).toBe('unreadable');
});

it('reports unavailable storage without throwing away the in-memory draft', () => {
  const draft = newPeerDraft(); draft.content.promptText = '나의 원문';
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded'); });
  expect(savePeerDraft(draft, null)).toBe('unavailable');
  expect(draft.content.promptText).toBe('나의 원문');
});

it('protects domain-only classification and restores legacy drafts without tags', () => {
  const draft = newPeerDraft();
  expect(hasDraftContent(draft)).toBe(false);
  draft.content.domain = 'DATA';
  expect(hasDraftContent(draft)).toBe(true);
  delete draft.content.tags;
  sessionStorage.setItem(PEER_DRAFT_KEY, JSON.stringify(draft));
  expect(readPeerDraft()?.content.tags).toEqual([]);
});
