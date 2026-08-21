import { useState } from 'react';
import Markdown from '../../components/Markdown';
import GatedCodeSnippet, {
  type GatedSnippetView,
} from '../../components/premium/GatedCodeSnippet';
import type { ResumeCodeSnippet, ResumeProfile, ResumeProject } from '../../api/resumeApi';

/**
 * 이력서는 게이트 뒤(ADR-0064)라 스니펫이 항상 전문이다 — 공개면과 같은 컴포넌트를
 * 잠기지 않은 형태로 쓴다. 게이트 UI 가 붙을 자리가 없으니 locked 는 항상 false 다.
 */
function unlockedView(snippet: ResumeCodeSnippet): GatedSnippetView {
  return {
    id: snippet.id,
    title: snippet.title,
    language: snippet.language,
    filePath: snippet.filePath,
    lineStart: snippet.lineStart,
    lineEnd: snippet.lineEnd,
    gitUrl: snippet.gitUrl,
    previewCode: snippet.code,
    totalLines: snippet.totalLines,
    locked: false,
    code: snippet.code,
  };
}

/** `2022-08` → `2022.08` — 이력서 표기 관례 */
function ym(value: string | null): string {
  return value ? value.replace('-', '.') : '';
}

function periodText(start: string | null, end: string | null, ongoing: boolean): string {
  if (!start) return '';
  return `${ym(start)} ~ ${ongoing || !end ? '현재' : ym(end)}`;
}

export function CareerSection({ profile }: { profile: ResumeProfile }) {
  const { career, companies } = profile;
  if (companies.length === 0) return null;

  return (
    <>
      <div className="resume-table-scroll">
        <table>
          <thead>
            <tr>
              <th>회사</th>
              <th>기간</th>
              <th>역할</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={`${c.name}-${c.startMonth}`}>
                <td><strong>{c.name}</strong></td>
                <td>
                  {periodText(c.startMonth, c.endMonth, c.ongoing)}
                  {' '}({c.tenureYears > 0 ? `${c.tenureYears}년 ` : ''}{c.tenureRemainderMonths}개월)
                </td>
                <td>{[c.position, c.team, c.note].filter(Boolean).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="resume-career-total">
        총 경력 {career.years}년 {career.months}개월 · {career.yearsInField}년차
      </p>
    </>
  );
}

/** 카테고리별로 묶어 보여준다 — 도메인이 곧 이력의 축이다 */
export function ProjectSection({ profile }: { profile: ResumeProfile }) {
  const { categories } = profile;
  // 기술 칩을 누르면 그 기술을 쓴 프로젝트만 남긴다. 화면 전용이고 인쇄에는 영향을 주지 않는다
  // — 인쇄본에서 일부만 담기면 사고다 (Resume.css 의 print 블록에서 전체를 되살린다).
  const [focusedSkill, setFocusedSkill] = useState<{ id: number; name: string } | null>(null);
  const projects = profile.projects;
  if (projects.length === 0) return null;

  /**
   * 필터는 화면에서만 걸린다. 걸러낸 항목을 렌더에서 빼면 그 상태로 인쇄했을 때 PDF 에도
   * 일부만 담긴다 — 채용 담당자가 받는 문서라 그건 사고다. 그래서 전부 렌더하고
   * CSS 로만 감추며, 인쇄에서는 다시 드러낸다.
   */
  const matches = (p: ResumeProject) =>
    !focusedSkill || p.skills.some((s) => s.id === focusedSkill.id);
  const matchedCount = projects.filter(matches).length;

  const uncategorized = projects.filter((p) => !p.categoryCode);
  const grouped = categories
    .map((category) => ({
      category,
      items: projects.filter((p) => p.categoryCode === category.code),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="resume-projects">
      {focusedSkill && (
        <div className="resume-skill-focus">
          <span><strong>{focusedSkill.name}</strong> 를 쓴 프로젝트 {matchedCount}건</span>
          <button type="button" onClick={() => setFocusedSkill(null)}>선택 해제</button>
        </div>
      )}
      {grouped.map(({ category, items }) => (
        <section
          key={category.code}
          className={`resume-project-group${items.some(matches) ? '' : ' is-filtered-out'}`}
        >
          <h3 className="resume-project-category">{category.label}</h3>
          {category.description && <p className="resume-project-category-desc">{category.description}</p>}
          {items.map((p) => (
            <ProjectCard
              key={`${p.title}-${p.orderNo}`}
              project={p}
              hidden={!matches(p)}
              onSkillClick={setFocusedSkill}
            />
          ))}
        </section>
      ))}
      {uncategorized.length > 0 && (
        <section
          className={`resume-project-group${uncategorized.some(matches) ? '' : ' is-filtered-out'}`}
        >
          {uncategorized.map((p) => (
            <ProjectCard
              key={`${p.title}-${p.orderNo}`}
              project={p}
              hidden={!matches(p)}
              onSkillClick={setFocusedSkill}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  hidden,
  onSkillClick,
}: {
  project: ResumeProject;
  hidden: boolean;
  onSkillClick: (skill: { id: number; name: string }) => void;
}) {
  const period = periodText(project.startMonth, project.endMonth, project.ongoing);
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <article className={`resume-project${hidden ? ' is-filtered-out' : ''}`}>
      <div className="resume-project-head">
        <h4 className="resume-project-title">
          {project.detailSlug ? (
            <a href={`/d/${project.detailSlug}`}>{project.title}</a>
          ) : (
            project.title
          )}
        </h4>
        <span className="resume-project-meta">
          {[project.companyName, period].filter(Boolean).join(' · ')}
        </span>
      </div>
      {project.summary && <p className="resume-project-summary">{project.summary}</p>}
      {project.bodyMarkdown && (
        <>
          {/* 접기도 필터와 같은 이유로 CSS 로만 처리한다 — 렌더에서 빼면 인쇄본에 빠진다. */}
          <button
            type="button"
            className="resume-project-detail-toggle"
            onClick={() => setDetailOpen((open) => !open)}
          >
            {detailOpen ? '▾ 접기' : '▸ 자세히'}
          </button>
          <div className={`resume-project-detail${detailOpen ? '' : ' is-collapsed'}`}>
            <Markdown className="resume-project-detail-body" source={project.bodyMarkdown} />
          </div>
        </>
      )}
      {project.metrics.length > 0 && (
        <ul className="resume-project-metrics">
          {project.metrics.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {project.snippets.length > 0 && (
        <div className="resume-project-snippets">
          {project.snippets.map((s, i) => (
            <GatedCodeSnippet key={s.id ?? `${project.title}-${i}`} snippet={unlockedView(s)} />
          ))}
        </div>
      )}
      {project.skills.length > 0 && (
        <div className="resume-project-tags">
          {project.skills.map((s) => (
            <button
              key={s.id}
              type="button"
              className="resume-project-tag"
              onClick={() => onSkillClick(s)}
              title={`${s.name} 를 쓴 프로젝트 모아보기`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export function SkillSection({ profile }: { profile: ResumeProfile }) {
  if (profile.skills.length === 0) return null;
  return (
    <ul className="resume-skills">
      {profile.skills.map((g) => (
        <li key={g.label}>
          <strong>{g.label}</strong> — {g.skills.map((s) => s.name).join(', ')}
          {g.note && <span className="resume-skill-note"> ({g.note})</span>}
        </li>
      ))}
    </ul>
  );
}
