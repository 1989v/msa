import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GNB from '../components/GNB';
import Markdown from '../components/Markdown';
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
 * 본문은 **공개용으로 따로 쓴 글**만 나간다. 게이트 뒤 본문에는 장애 대응의 구체적 경위가
 * 들어가므로 응답 DTO 가 그 필드를 아예 모른다.
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
  const [opened, setOpened] = useState<OpenedProject | null>(null);

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
    <>
      {/* 머리띠는 컨테이너 밖에 둔다 — 안에 넣으면 max-width 에 갇혀 전폭이 아니게 된다.
          공개면이라 메인으로 돌아갈 길과 테마 토글이 있어야 한다. */}
      <GNB items={[{ label: '홈', href: '/' }]} />
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
                  categoryLabel={category.label}
                  hidden={!matches(project)}
                  onTagClick={setFocusedTag}
                  onOpen={setOpened}
                />
              ))}
            </div>
          </section>
        ))}
        </div>

        {opened && (
          <ProjectDialog
            opened={opened}
            onClose={() => setOpened(null)}
            onTagClick={(tag) => {
              setOpened(null);
              setFocusedTag(tag);
            }}
          />
        )}
      </div>
    </>
  );
}

interface OpenedProject {
  project: PortfolioProject;
  categoryLabel: string;
}

function ProjectCard({
  project,
  categoryLabel,
  hidden,
  onTagClick,
  onOpen,
}: {
  project: PortfolioProject;
  categoryLabel: string;
  hidden: boolean;
  onTagClick: (tag: string) => void;
  onOpen: (opened: OpenedProject) => void;
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
      {project.body && (
        <>
          <button
            type="button"
            className="portfolio-card-more"
            onClick={() => onOpen({ project, categoryLabel })}
          >
            자세히 <span aria-hidden="true">→</span>
          </button>
          {/*
            본문을 DOM 에 남긴다. 모달은 열릴 때만 그려지므로, 이게 없으면 프리렌더 결과에
            본문이 빠져 크롤러가 이 페이지의 알맹이를 못 본다. 보조기기에는 중복이라
            aria-hidden 으로 숨긴다 — 같은 글을 모달에서 다시 읽게 된다.
          */}
          <div className="portfolio-card-seed" aria-hidden="true">
            <Markdown source={project.body} />
          </div>
        </>
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

/**
 * 상세 모달.
 *
 * 처마 아래 문을 여는 감각으로 만든다 — 뒤는 먹빛으로 가라앉히고(ink in water), 판은
 * 비대칭 모서리에 결을 입혀 앞으로 나온다. 그림자는 쓰지 않는다: 이 시스템의 깊이는
 * 면의 색 단차와 테두리로 만든다.
 */
function ProjectDialog({
  opened,
  onClose,
  onTagClick,
}: {
  opened: OpenedProject;
  onClose: () => void;
  onTagClick: (tag: string) => void;
}) {
  const { project, categoryLabel } = opened;
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 포커스를 모달 안에 가둔다. 없으면 탭이 뒤 페이지로 새어나가 어디를 누르는지 알 수 없다.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    closeRef.current?.focus();
    // 뒤 페이지가 같이 스크롤되면 모달이 종이 위에 뜬 게 아니라 붙어 있는 것처럼 보인다.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="portfolio-dialog-veil" onClick={onClose}>
      <div
        ref={panelRef}
        className="portfolio-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="portfolio-dialog-head">
          <span className="kh-seal kh-seal-ink">
            <span className="kh-seal-dot" aria-hidden="true" />
            {categoryLabel}
          </span>
          <button ref={closeRef} type="button" className="portfolio-dialog-close" onClick={onClose}>
            닫기 <span aria-hidden="true">✕</span>
          </button>
        </div>

        <h2 id="portfolio-dialog-title" className="portfolio-dialog-title">
          {project.title}
        </h2>

        {project.summary && <p className="portfolio-dialog-summary">{project.summary}</p>}

        {project.metrics.length > 0 && (
          <ul className="portfolio-dialog-metrics">
            {project.metrics.map((metric) => (
              <li key={metric}>{metric}</li>
            ))}
          </ul>
        )}

        {project.body && (
          <div className="portfolio-dialog-body">
            <Markdown source={project.body} />
          </div>
        )}

        {project.tags.length > 0 && (
          <div className="portfolio-dialog-tags">
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
      </div>
    </div>
  );
}
