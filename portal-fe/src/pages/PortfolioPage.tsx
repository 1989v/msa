import { useEffect, useMemo, useState } from 'react';
import {
  fetchPortfolioProjects,
  type PortfolioProject,
  type PortfolioProjects,
} from '../api/portfolioApi';
import { portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import './PortfolioPage.css';

/**
 * `/portfolio` 공개 아카이브 (ADR-0066 개정).
 *
 * 이력서와 **같은 데이터를 다른 범위로** 보여준다. 내용은 공개하되 어느 회사에서 한
 * 일인지는 서버가 아예 내려보내지 않는다 — 화면에서 가리는 게 아니라 응답에 없다.
 *
 * 예전에는 `portfolio_card` 라는 별도 테이블을 봤는데, 프로젝트를 담는 곳이 둘이면
 * 반드시 한쪽만 갱신되어 두 화면이 다른 이력을 말하게 된다.
 *
 * 공개 범위는 **요약과 지표까지**다. 본문(장애 대응 경위 등)은 응답에 없다.
 */
export default function PortfolioPage() {
  useHeritageSurface();
  useSeo({
    title: portalTitle('포트폴리오'),
    description:
      '검색·전시·커머스·인프라·AI 엔지니어링 도메인에서 만든 것들과 그때의 판단.',
    canonical: portalUrl('/portfolio'),
  });

  const [data, setData] = useState<PortfolioProjects | null>(null);
  const [failed, setFailed] = useState(false);
  const [focusedTag, setFocusedTag] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPortfolioProjects()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!data) return [];
    return data.categories
      .map((category) => ({
        category,
        items: data.projects.filter((p) => p.categoryCode === category.code),
      }))
      .filter((group) => group.items.length > 0);
  }, [data]);

  const matches = (project: PortfolioProject) =>
    !focusedTag || project.tags.includes(focusedTag);

  const matchedCount = data?.projects.filter(matches).length ?? 0;

  return (
    <div className="portfolio-page">
      <div className="portfolio-inner">
        <header className="portfolio-header">
          <span className="kh-section-label">Project Archive</span>
          <h1 className="portfolio-title">
            만든 것들과
            <br />
            <span className="kh-display-accent">그때의 판단.</span>
          </h1>
          <p className="portfolio-subtitle">
            검색·전시·커머스·인프라·AI 엔지니어링에서 다룬 일들입니다. 회사에서 한 일은
            회사를 밝히지 않고 내용만 둡니다.
          </p>
        </header>

        {failed && (
          <div className="kh-status kh-status-error" role="alert">
            <span className="kh-status-title">Error</span>
            기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        )}

        {!data && !failed && (
          <div className="kh-status">
            <span className="kh-status-title">Loading</span>
            불러오는 중…
          </div>
        )}

        {data && data.projects.length === 0 && (
          <div className="kh-status">
            <span className="kh-status-title">Empty</span>
            아직 공개된 기록이 없습니다.
          </div>
        )}

        {focusedTag && (
          <div className="portfolio-focus">
            <span>
              <strong>{focusedTag}</strong> 를 쓴 기록 {matchedCount}건
            </span>
            <button type="button" onClick={() => setFocusedTag(null)}>
              선택 해제
            </button>
          </div>
        )}

        {grouped.map(({ category, items }) => (
          <section
            key={category.code}
            className={`portfolio-group${items.some(matches) ? '' : ' is-filtered-out'}`}
          >
            <div className="kh-section-head">
              <h2 className="portfolio-group-title">{category.label}</h2>
            </div>
            {category.description && (
              <p className="portfolio-group-desc">{category.description}</p>
            )}
            <div className="portfolio-grid">
              {items.map((project) => (
                <ProjectCard
                  key={project.title}
                  project={project}
                  hidden={!matches(project)}
                  onTagClick={setFocusedTag}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  hidden,
  onTagClick,
}: {
  project: PortfolioProject;
  hidden: boolean;
  onTagClick: (tag: string) => void;
}) {
  return (
    <article className={`portfolio-card${hidden ? ' is-filtered-out' : ''}`}>
      <h3 className="portfolio-card-title">{project.title}</h3>
      {project.summary && <p className="portfolio-card-summary">{project.summary}</p>}
      {project.metrics.length > 0 && (
        <ul className="portfolio-card-metrics">
          {project.metrics.map((metric) => (
            <li key={metric}>{metric}</li>
          ))}
        </ul>
      )}
      {project.tags.length > 0 && (
        <div className="portfolio-card-tags">
          {project.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="portfolio-card-tag"
              onClick={() => onTagClick(tag)}
              title={`${tag} 를 쓴 기록 모아보기`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
