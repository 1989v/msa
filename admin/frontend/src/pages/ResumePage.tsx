import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createShareLink,
  deleteDocument,
  fetchVisibility,
  getDocument,
  listDocuments,
  listShareLinks,
  listVisits,
  revokeShareLink,
  shareUrl,
  updateVisibility,
  upsertDocument,
  type ResumeDocumentKind,
  type ResumeDocumentSummary,
  type ResumeShareLink,
  type ResumeVisibility,
  type ResumeVisit,
} from '@/api/resume';

const EMPTY_DRAFT = {
  slug: '',
  title: '',
  bodyMarkdown: '',
  kind: 'DETAIL' as ResumeDocumentKind,
  orderNo: 0,
  published: true,
};

function formatDateTime(value: string | null): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '—';
}

export function ResumePage() {
  const [visibility, setVisibility] = useState<ResumeVisibility>('TOKEN_ONLY');
  const [documents, setDocuments] = useState<ResumeDocumentSummary[]>([]);
  const [links, setLinks] = useState<ResumeShareLink[]>([]);
  const [visits, setVisits] = useState<ResumeVisit[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [newLabel, setNewLabel] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [v, docs, shareLinks, recentVisits] = await Promise.all([
      fetchVisibility(),
      listDocuments(),
      listShareLinks(),
      listVisits(50),
    ]);
    setVisibility(v);
    setDocuments(docs);
    setLinks(shareLinks);
    setVisits(recentVisits);
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const toggleVisibility = async () => {
    const next: ResumeVisibility = visibility === 'PUBLIC' ? 'TOKEN_ONLY' : 'PUBLIC';
    setVisibility(await updateVisibility(next));
    setMessage(next === 'PUBLIC' ? '전체 공개로 전환했습니다' : '토큰 전용으로 닫았습니다');
  };

  const editDocument = async (slug: string) => {
    const doc = await getDocument(slug);
    const summary = documents.find((d) => d.slug === slug);
    setDraft({
      slug: doc.slug,
      title: doc.title,
      bodyMarkdown: doc.bodyMarkdown,
      kind: doc.kind,
      orderNo: doc.orderNo,
      published: summary?.published ?? true,
    });
  };

  const saveDocument = async () => {
    try {
      await upsertDocument(draft);
      setDraft(EMPTY_DRAFT);
      setMessage('저장했습니다');
      await reload();
    } catch {
      setMessage('저장에 실패했습니다 — slug 는 소문자·숫자·하이픈만 가능합니다');
    }
  };

  const removeDocument = async (slug: string) => {
    if (!window.confirm(`${slug} 문서를 삭제할까요?`)) return;
    await deleteDocument(slug);
    await reload();
  };

  const issueLink = async () => {
    if (!newLabel.trim()) return;
    await createShareLink(newLabel.trim());
    setNewLabel('');
    await reload();
  };

  const revoke = async (id: number) => {
    if (!window.confirm('이 링크를 폐기할까요? 이후 접속은 404 가 됩니다.')) return;
    await revokeShareLink(id);
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">이력서</h1>
          <p className="text-sm text-zinc-500">
            resume.1989v.com 에 서빙되는 본문의 원본이다. 여기서 고친 내용이 곧 사이트 내용이다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      {/* 공개 상태 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">
              {visibility === 'PUBLIC' ? '전체 공개 (구인중)' : '토큰 전용 (닫힘)'}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {visibility === 'PUBLIC'
                ? '누구나 resume.1989v.com 을 열 수 있고, 메인에 이력서 진입점이 노출됩니다.'
                : '발급한 링크로만 열립니다. 토큰 없이 접속하면 404 이고, 메인에도 진입점이 없습니다.'}
            </p>
          </div>
          <Button variant={visibility === 'PUBLIC' ? 'destructive' : 'default'} onClick={toggleVisibility}>
            {visibility === 'PUBLIC' ? '닫기' : '전체 공개'}
          </Button>
        </div>
      </Card>

      {/* 문서 */}
      <Card className="p-4">
        <h2 className="mb-3 font-medium">문서</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3">slug</th>
                <th className="py-2 pr-3">제목</th>
                <th className="py-2 pr-3">종류</th>
                <th className="py-2 pr-3">순서</th>
                <th className="py-2 pr-3">공개</th>
                <th className="py-2 pr-3">수정</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.slug} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-3 font-mono text-xs">{doc.slug}</td>
                  <td className="py-2 pr-3">{doc.title}</td>
                  <td className="py-2 pr-3">{doc.kind}</td>
                  <td className="py-2 pr-3">{doc.orderNo}</td>
                  <td className="py-2 pr-3">{doc.published ? 'Y' : 'N'}</td>
                  <td className="py-2 pr-3 text-zinc-500">{formatDateTime(doc.updatedAt)}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => editDocument(doc.slug)}>
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => removeDocument(doc.slug)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-zinc-500">
                    아직 문서가 없습니다. 아래에 마크다운을 붙여넣어 등록하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="slug (예: main, search-platform)"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="제목"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <select
                className="h-9 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as ResumeDocumentKind })}
              >
                <option value="MAIN">MAIN</option>
                <option value="DETAIL">DETAIL</option>
              </select>
              <Input
                className="w-16"
                type="number"
                value={draft.orderNo}
                onChange={(e) => setDraft({ ...draft, orderNo: Number(e.target.value) })}
              />
            </div>
          </div>
          <textarea
            className="h-64 w-full rounded-md border border-zinc-300 bg-transparent p-3 font-mono text-xs dark:border-zinc-700"
            placeholder="마크다운 본문"
            value={draft.bodyMarkdown}
            onChange={(e) => setDraft({ ...draft, bodyMarkdown: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              공개
            </label>
            <Button onClick={saveDocument}>저장</Button>
            <Button variant="ghost" onClick={() => setDraft(EMPTY_DRAFT)}>
              초기화
            </Button>
          </div>
        </div>
      </Card>

      {/* 제출처별 링크 */}
      <Card className="p-4">
        <h2 className="mb-3 font-medium">제출처별 링크</h2>
        <div className="mb-4 flex gap-2">
          <Input
            placeholder="제출처 (예: OO사 백엔드)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Button onClick={issueLink}>발급</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3">제출처</th>
                <th className="py-2 pr-3">링크</th>
                <th className="py-2 pr-3">열람</th>
                <th className="py-2 pr-3">첫 열람</th>
                <th className="py-2 pr-3">마지막</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-3">
                    {link.label}
                    {link.revokedAt && <span className="ml-2 text-xs text-red-500">폐기됨</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="font-mono text-xs text-blue-500 hover:underline"
                      onClick={() => navigator.clipboard.writeText(shareUrl(link.token))}
                      title="클릭하면 복사됩니다"
                    >
                      {shareUrl(link.token)}
                    </button>
                  </td>
                  <td className="py-2 pr-3 font-medium">{link.visitCount}</td>
                  <td className="py-2 pr-3 text-zinc-500">{formatDateTime(link.firstVisitedAt)}</td>
                  <td className="py-2 pr-3 text-zinc-500">{formatDateTime(link.lastVisitedAt)}</td>
                  <td className="py-2 text-right">
                    {!link.revokedAt && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(link.id)}>
                        폐기
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {links.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-zinc-500">
                    발급한 링크가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 최근 열람 */}
      <Card className="p-4">
        <h2 className="mb-3 font-medium">최근 열람</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3">제출처</th>
                <th className="py-2 pr-3">문서</th>
                <th className="py-2">시각</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit, i) => (
                <tr key={`${visit.visitedAt}-${i}`} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-3">{visit.label ?? '(익명 — 전체공개)'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{visit.slug}</td>
                  <td className="py-2 text-zinc-500">{formatDateTime(visit.visitedAt)}</td>
                </tr>
              ))}
              {visits.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-zinc-500">
                    아직 열람 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
