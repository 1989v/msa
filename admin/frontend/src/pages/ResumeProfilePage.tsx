import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  deleteCategory,
  deleteCompany,
  deleteProject,
  deleteSkill,
  deleteSkillGroup,
  fetchProfile,
  upsertCategory,
  upsertCompany,
  upsertProject,
  upsertSkill,
  upsertSkillGroup,
  type ResumeProfile,
} from '@/api/resume';

const MONTH_HINT = 'YYYY-MM';

const EMPTY_COMPANY = { id: null as number | null, name: '', startMonth: '', endMonth: '', position: '', team: '' };
const EMPTY_CATEGORY = { id: null as number | null, code: '', label: '', description: '', orderNo: 0 };
const EMPTY_PROJECT = {
  id: null as number | null,
  title: '',
  companyId: null as number | null,
  categoryId: null as number | null,
  startMonth: '',
  endMonth: '',
  summary: '',
  metrics: '',
  skillIds: [] as number[],
  detailSlug: '',
  orderNo: 0,
  published: true,
};
const EMPTY_SKILL_GROUP = { id: null as number | null, label: '', orderNo: 0 };
const EMPTY_SKILL = { id: null as number | null, name: '', groupId: null as number | null, orderNo: 0 };

/** 빈 문자열은 "값 없음"이다 — 서버에 빈 문자열을 보내면 파싱 오류가 된다. */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function ResumeProfilePage() {
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [category, setCategory] = useState(EMPTY_CATEGORY);
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [skillGroup, setSkillGroup] = useState(EMPTY_SKILL_GROUP);
  const [skill, setSkill] = useState(EMPTY_SKILL);

  const reload = useCallback(async () => {
    setProfile(await fetchProfile());
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch {
      setMessage('실패했습니다 — 기간은 YYYY-MM, 카테고리 코드는 소문자·숫자·하이픈만 가능합니다');
    }
  };

  if (!profile) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  const { career } = profile;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">이력서 — 경력 데이터</h1>
          <p className="text-sm text-zinc-500">
            서술은 문서(마크다운)가, 계산·반복되는 항목은 여기가 담당합니다.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      {/* 자동 계산 결과 */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-8">
          <Stat label="총 경력" value={`${career.years}년 ${career.months}개월`} />
          <Stat label="연차" value={`${career.yearsInField}년차`} />
          <Stat label="합산 개월" value={`${career.totalMonths}개월`} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          아래 재직 기간에서 매번 다시 계산합니다. 이직 공백은 빠지고, 진행 중인 재직은 완료된 달까지만 셉니다.
        </p>
      </Card>

      {/* 회사 */}
      <Card className="p-4">
        <h2 className="mb-3 font-medium">회사</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr><th className="py-2 pr-3">회사</th><th className="py-2 pr-3">기간</th><th className="py-2 pr-3">재직</th><th className="py-2 pr-3">직급/팀</th><th className="py-2" /></tr>
            </thead>
            <tbody>
              {profile.companies.map((c) => (
                <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-3 font-medium">{c.name}</td>
                  <td className="py-2 pr-3">{c.startMonth} ~ {c.endMonth ?? '현재'}</td>
                  <td className="py-2 pr-3">{c.tenureYears}년 {c.tenureRemainderMonths}개월</td>
                  <td className="py-2 pr-3 text-zinc-500">{[c.position, c.team].filter(Boolean).join(' · ')}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setCompany({
                      id: c.id, name: c.name, startMonth: c.startMonth, endMonth: c.endMonth ?? '',
                      position: c.position ?? '', team: c.team ?? '',
                    })}>편집</Button>
                    <Button size="sm" variant="ghost" className="ml-2" onClick={() => c.id && run(() => deleteCompany(c.id!), '삭제했습니다')}>삭제</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 border-t border-zinc-200 pt-4 sm:grid-cols-6 dark:border-zinc-800">
          {/* 순서 입력은 없다 — 경력 표는 시작월 최신순으로 정렬된다 */}
          <Input placeholder="회사명" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          <Input placeholder={`시작 ${MONTH_HINT}`} value={company.startMonth} onChange={(e) => setCompany({ ...company, startMonth: e.target.value })} />
          <Input placeholder={`종료 ${MONTH_HINT} (비우면 재직중)`} value={company.endMonth} onChange={(e) => setCompany({ ...company, endMonth: e.target.value })} />
          <Input placeholder="직급" value={company.position} onChange={(e) => setCompany({ ...company, position: e.target.value })} />
          <Input placeholder="팀" value={company.team} onChange={(e) => setCompany({ ...company, team: e.target.value })} />
          <Button onClick={() => run(async () => {
            await upsertCompany({
              id: company.id ?? undefined, name: company.name, startMonth: company.startMonth,
              endMonth: blankToNull(company.endMonth), position: blankToNull(company.position),
              team: blankToNull(company.team),
            } as never);
            setCompany(EMPTY_COMPANY);
          }, '저장했습니다')}>저장</Button>
        </div>
      </Card>

      {/* 카테고리 */}
      <Card className="p-4">
        <h2 className="mb-3 font-medium">카테고리</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {profile.categories.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">
              <button type="button" className="hover:underline" onClick={() => setCategory({
                id: c.id, code: c.code, label: c.label, description: c.description ?? '', orderNo: c.orderNo,
              })}>{c.label} <span className="text-zinc-500">({c.code})</span></button>
              <button type="button" className="text-zinc-400 hover:text-red-500" onClick={() => c.id && run(() => deleteCategory(c.id!), '삭제했습니다')}>×</button>
            </span>
          ))}
          {profile.categories.length === 0 && <span className="text-sm text-zinc-500">아직 없습니다.</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          <Input placeholder="코드 (search)" value={category.code} onChange={(e) => setCategory({ ...category, code: e.target.value })} />
          <Input placeholder="이름 (검색)" value={category.label} onChange={(e) => setCategory({ ...category, label: e.target.value })} />
          <Input className="sm:col-span-2" placeholder="설명 (선택)" value={category.description} onChange={(e) => setCategory({ ...category, description: e.target.value })} />
          <div className="flex gap-2">
            <Input className="w-16" type="number" value={category.orderNo} onChange={(e) => setCategory({ ...category, orderNo: Number(e.target.value) })} />
            <Button onClick={() => run(async () => {
              await upsertCategory({
                id: category.id ?? undefined, code: category.code, label: category.label,
                description: blankToNull(category.description), orderNo: category.orderNo,
              } as never);
              setCategory(EMPTY_CATEGORY);
            }, '저장했습니다')}>저장</Button>
          </div>
        </div>
      </Card>

      {/* 프로젝트 */}
      <Card className="p-4">
        <h2 className="mb-3 font-medium">프로젝트</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr><th className="py-2 pr-3">제목</th><th className="py-2 pr-3">회사</th><th className="py-2 pr-3">카테고리</th><th className="py-2 pr-3">기간</th><th className="py-2 pr-3">기술 스택</th><th className="py-2 pr-3">상세</th><th className="py-2 pr-3">공개</th><th className="py-2" /></tr>
            </thead>
            <tbody>
              {profile.projects.map((p) => (
                <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-3">{p.title}</td>
                  <td className="py-2 pr-3 text-zinc-500">{p.companyName ?? '개인'}</td>
                  <td className="py-2 pr-3">{p.categoryLabel ?? '—'}</td>
                  <td className="py-2 pr-3 text-zinc-500">{p.startMonth ? `${p.startMonth} ~ ${p.endMonth ?? '현재'}` : '—'}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">{p.skills.length > 0 ? p.skills.map((s) => s.name).join(', ') : '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{p.detailSlug ?? '—'}</td>
                  <td className="py-2 pr-3">{p.published ? 'Y' : 'N'}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setProject({
                      id: p.id, title: p.title, companyId: p.companyId, categoryId: p.categoryId,
                      startMonth: p.startMonth ?? '', endMonth: p.endMonth ?? '', summary: p.summary ?? '',
                      metrics: p.metrics.join('\n'), skillIds: p.skills.map((s) => s.id),
                      detailSlug: p.detailSlug ?? '', orderNo: p.orderNo, published: p.published,
                    })}>편집</Button>
                    <Button size="sm" variant="ghost" className="ml-2" onClick={() => p.id && run(() => deleteProject(p.id!), '삭제했습니다')}>삭제</Button>
                  </td>
                </tr>
              ))}
              {profile.projects.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-zinc-500">아직 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input className="sm:col-span-2" placeholder="제목" value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} />
            <select className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={project.companyId ?? ''} onChange={(e) => setProject({ ...project, companyId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">개인 프로젝트</option>
              {profile.companies.map((c) => <option key={c.id} value={c.id ?? ''}>{c.name}</option>)}
            </select>
            <select className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={project.categoryId ?? ''} onChange={(e) => setProject({ ...project, categoryId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">카테고리 없음</option>
              {profile.categories.map((c) => <option key={c.id} value={c.id ?? ''}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input placeholder={`시작 ${MONTH_HINT}`} value={project.startMonth} onChange={(e) => setProject({ ...project, startMonth: e.target.value })} />
            <Input placeholder={`종료 ${MONTH_HINT}`} value={project.endMonth} onChange={(e) => setProject({ ...project, endMonth: e.target.value })} />
            <Input placeholder="상세 문서 slug (선택)" value={project.detailSlug} onChange={(e) => setProject({ ...project, detailSlug: e.target.value })} />
            <Input type="number" value={project.orderNo} onChange={(e) => setProject({ ...project, orderNo: Number(e.target.value) })} />
          </div>
          <Input placeholder="한 줄 요약" value={project.summary} onChange={(e) => setProject({ ...project, summary: e.target.value })} />
          <textarea className="h-24 w-full rounded-md border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
            placeholder="성과 지표 — 한 줄에 하나 (예: CTR +3.4%)"
            value={project.metrics} onChange={(e) => setProject({ ...project, metrics: e.target.value })} />
          <div>
            <div className="mb-1 text-xs text-zinc-500">
              기술 스택 — 아래 기술 스택 섹션에 등록된 것만 고를 수 있습니다
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.skills.flatMap((g) => g.skills).length === 0 && (
                <span className="text-xs text-zinc-500">등록된 기술이 없습니다.</span>
              )}
              {profile.skills.map((g) =>
                g.skills.map((sk) => {
                  const on = project.skillIds.includes(sk.id);
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => setProject({
                        ...project,
                        skillIds: on
                          ? project.skillIds.filter((id) => id !== sk.id)
                          : [...project.skillIds, sk.id],
                      })}
                      className={`rounded-md border px-2 py-1 text-xs ${on
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-zinc-300 text-zinc-500 dark:border-zinc-700'}`}
                    >
                      {sk.name}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={project.published} onChange={(e) => setProject({ ...project, published: e.target.checked })} />공개
            </label>
            <Button onClick={() => run(async () => {
              await upsertProject({
                id: project.id ?? undefined, title: project.title, companyId: project.companyId,
                categoryId: project.categoryId, startMonth: blankToNull(project.startMonth),
                endMonth: blankToNull(project.endMonth), summary: blankToNull(project.summary),
                metrics: splitList(project.metrics), skillIds: project.skillIds,
                detailSlug: blankToNull(project.detailSlug),
                orderNo: project.orderNo, published: project.published,
              } as never);
              setProject(EMPTY_PROJECT);
            }, '저장했습니다')}>저장</Button>
            <Button variant="ghost" onClick={() => setProject(EMPTY_PROJECT)}>초기화</Button>
          </div>
        </div>
      </Card>

      {/* 기술 스택 */}
      <Card className="p-4">
        <h2 className="mb-1 font-medium">기술 스택</h2>
        <p className="mb-3 text-sm text-zinc-500">
          여기 등록한 기술만 프로젝트에서 고를 수 있습니다. 같은 기술이 두 이름으로 갈라지지 않게 하는 게 목적입니다.
        </p>

        <div className="space-y-3">
          {profile.skills.map((g) => (
            <div key={g.id} className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-sm font-medium">{g.label}</span>
                <Button size="sm" variant="ghost" onClick={() => setSkillGroup({ id: g.id, label: g.label, orderNo: g.orderNo })}>이름 수정</Button>
                <Button size="sm" variant="ghost" onClick={() => g.id && run(() => deleteSkillGroup(g.id!), '그룹을 삭제했습니다')}>그룹 삭제</Button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 pl-32">
                {g.skills.map((sk) => (
                  <span key={sk.id} className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">
                    {sk.name}
                    <button type="button" className="text-zinc-400 hover:text-red-500"
                      onClick={() => run(() => deleteSkill(sk.id), '기술을 삭제했습니다')}>×</button>
                  </span>
                ))}
                {g.skills.length === 0 && <span className="text-xs text-zinc-500">비어 있음</span>}
              </div>
            </div>
          ))}
          {profile.skills.length === 0 && <p className="text-sm text-zinc-500">그룹이 없습니다.</p>}
        </div>

        <div className="mt-4 grid gap-2 border-t border-zinc-200 pt-4 sm:grid-cols-4 dark:border-zinc-800">
          <Input placeholder="그룹 추가/수정 (예: Language)" value={skillGroup.label}
            onChange={(e) => setSkillGroup({ ...skillGroup, label: e.target.value })} />
          <div className="flex gap-2">
            <Input className="w-16" type="number" value={skillGroup.orderNo}
              onChange={(e) => setSkillGroup({ ...skillGroup, orderNo: Number(e.target.value) })} />
            <Button onClick={() => run(async () => {
              await upsertSkillGroup({ id: skillGroup.id ?? undefined, label: skillGroup.label, orderNo: skillGroup.orderNo });
              setSkillGroup(EMPTY_SKILL_GROUP);
            }, '저장했습니다')}>그룹 저장</Button>
          </div>

          <Input placeholder="기술 추가 (예: Kotlin)" value={skill.name}
            onChange={(e) => setSkill({ ...skill, name: e.target.value })} />
          <div className="flex gap-2">
            <select className="h-9 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={skill.groupId ?? ''} onChange={(e) => setSkill({ ...skill, groupId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">미분류</option>
              {profile.skills.map((g) => <option key={g.id} value={g.id ?? ''}>{g.label}</option>)}
            </select>
            <Button onClick={() => run(async () => {
              await upsertSkill({ name: skill.name, groupId: skill.groupId });
              setSkill(EMPTY_SKILL);
            }, '저장했습니다')}>기술 저장</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
