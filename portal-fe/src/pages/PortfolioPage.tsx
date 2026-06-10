import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPortfolioCard,
  listPortfolioCards,
  type PortfolioCardDetail,
  type PortfolioCardSummary,
  type PortfolioSort,
} from '../api/portfolioApi';
import './PortfolioPage.css';

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  const startStr = start ? start.slice(0, 7) : '';
  const endStr = end ? end.slice(0, 7) : '진행 중';
  if (!startStr) return endStr;
  return `${startStr} ~ ${endStr}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function PortfolioPage() {
  const [cards, setCards] = useState<PortfolioCardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<PortfolioSort>('time');
  const [q, setQ] = useState('');
  const [activeStacks, setActiveStacks] = useState<string[]>([]);

  const [selectedCard, setSelectedCard] = useState<PortfolioCardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const modalOpen = selectedCard !== null || detailLoading || detailError !== null;

  const closeDetail = useCallback(() => {
    setSelectedCard(null);
    setDetailError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const handle = setTimeout(() => {
      listPortfolioCards({ sort, q, stack: activeStacks })
        .then((page) => {
          if (!cancelled) setCards(page.content);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(errorMessage(err, '카드를 불러오지 못했습니다'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [sort, q, activeStacks]);

  useEffect(() => {
    if (!modalOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, closeDetail]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const toggleStack = (tag: string) => {
    setActiveStacks((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getPortfolioCard(id);
      setSelectedCard(detail);
    } catch (err: unknown) {
      setDetailError(errorMessage(err, '카드 상세를 불러오지 못했습니다'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="portfolio-page">
      <div className="portfolio-inner">
        <header className="portfolio-header">
          <h1 className="portfolio-title">Portfolio</h1>
          <p className="portfolio-subtitle">
            그동안 일군 프로젝트·기능·트러블슈팅·학습을 시간순/임팩트순으로.
          </p>
        </header>

        <div className="portfolio-toolbar">
          <input
            className="portfolio-search"
            aria-label="포트폴리오 키워드 검색"
            placeholder="키워드 검색 (제목 / 요약 / 본문)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="portfolio-sort" role="group" aria-label="정렬">
            <button
              className={sort === 'time' ? 'active' : ''}
              onClick={() => setSort('time')}
              type="button"
            >
              최신순
            </button>
            <button
              className={sort === 'impact' ? 'active' : ''}
              onClick={() => setSort('impact')}
              type="button"
            >
              임팩트순
            </button>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="portfolio-tag-filter">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={activeStacks.includes(tag)}
                className={`portfolio-tag-chip ${activeStacks.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleStack(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {loading && <div className="portfolio-loading">불러오는 중…</div>}
        {error && (
          <div className="portfolio-error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && cards.length === 0 && (
          <div className="portfolio-empty">
            아직 등록된 카드가 없습니다. <br />
            <small>seed DML을 실행하거나 어드민에서 카드를 추가하세요.</small>
          </div>
        )}

        {!loading && !error && cards.length > 0 && (
          <div className="portfolio-grid">
            {cards.map((card) => (
              <article
                key={card.id}
                className="portfolio-card"
                role="button"
                tabIndex={0}
                onClick={() => openDetail(card.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(card.id);
                  }
                }}
              >
                <span className="portfolio-card-impact" title="Impact score">
                  ★ {card.impact}
                </span>
                <h2 className="portfolio-card-title">{card.title}</h2>
                {(card.periodStart || card.periodEnd) && (
                  <div className="portfolio-card-period">
                    {formatPeriod(card.periodStart, card.periodEnd)}
                    {card.role ? ` · ${card.role}` : ''}
                  </div>
                )}
                {card.summary && (
                  <p className="portfolio-card-summary">{card.summary}</p>
                )}
                {card.tags.length > 0 && (
                  <div className="portfolio-card-tags">
                    {card.tags.map((tag) => (
                      <span key={tag} className="portfolio-card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="portfolio-modal-backdrop" onClick={closeDetail}>
          <div
            className="portfolio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={selectedCard ? 'portfolio-modal-title' : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              className="portfolio-modal-close"
              onClick={closeDetail}
              aria-label="닫기"
              type="button"
            >
              ×
            </button>
            {detailLoading && <div className="portfolio-loading">불러오는 중…</div>}
            {detailError && (
              <div className="portfolio-error" role="alert">
                {detailError}
              </div>
            )}
            {selectedCard && (
              <>
                <h2 id="portfolio-modal-title" className="portfolio-modal-title">
                  {selectedCard.title}
                </h2>
                <div className="portfolio-modal-meta">
                  {(selectedCard.periodStart || selectedCard.periodEnd) && (
                    <span>{formatPeriod(selectedCard.periodStart, selectedCard.periodEnd)}</span>
                  )}
                  {selectedCard.role && <span>{selectedCard.role}</span>}
                  <span>Impact ★ {selectedCard.impact}</span>
                </div>
                <div className="portfolio-modal-body">{selectedCard.body}</div>
                {selectedCard.tags.length > 0 && (
                  <div className="portfolio-modal-tags">
                    {selectedCard.tags.map((tag) => (
                      <span key={tag} className="portfolio-card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
