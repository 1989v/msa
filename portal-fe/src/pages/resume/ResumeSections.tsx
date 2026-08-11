import type { ResumeProfile, ResumeProject } from '../../api/resumeApi';

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
  const { projects, categories } = profile;
  if (projects.length === 0) return null;

  const uncategorized = projects.filter((p) => !p.categoryCode);
  const grouped = categories
    .map((category) => ({
      category,
      items: projects.filter((p) => p.categoryCode === category.code),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="resume-projects">
      {grouped.map(({ category, items }) => (
        <section key={category.code} className="resume-project-group">
          <h3 className="resume-project-category">{category.label}</h3>
          {category.description && <p className="resume-project-category-desc">{category.description}</p>}
          {items.map((p) => <ProjectCard key={`${p.title}-${p.orderNo}`} project={p} />)}
        </section>
      ))}
      {uncategorized.length > 0 && (
        <section className="resume-project-group">
          {uncategorized.map((p) => <ProjectCard key={`${p.title}-${p.orderNo}`} project={p} />)}
        </section>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ResumeProject }) {
  const period = periodText(project.startMonth, project.endMonth, project.ongoing);
  return (
    <article className="resume-project">
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
      {project.metrics.length > 0 && (
        <ul className="resume-project-metrics">
          {project.metrics.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      {project.tags.length > 0 && (
        <div className="resume-project-tags">
          {project.tags.map((t) => <span key={t} className="resume-project-tag">{t}</span>)}
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
          <strong>{g.label}</strong> — {g.items.join(', ')}
          {g.note && <span className="resume-skill-note"> ({g.note})</span>}
        </li>
      ))}
    </ul>
  );
}
