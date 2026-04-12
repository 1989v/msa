import { useState, useRef, useCallback, useEffect } from 'react';
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext';
import type { GraphNode } from '../../types/graph';
import type { Category } from '../../types/index';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../types/index';
import './ConceptCascade.css';

interface ConceptCascadeProps {
  nodes: GraphNode[];
}

type GamePhase = 'idle' | 'playing' | 'results';

interface CardResult {
  node: GraphNode;
  outcome: 'correct' | 'wrong' | 'missed';
  droppedCategory?: Category;
}

interface PulseRing {
  id: number;
  x: number;
  y: number;
}

/* ── Helpers ── */

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickCategories(nodes: GraphNode[], count: number): Category[] {
  const freq = new Map<Category, number>();
  for (const n of nodes) {
    freq.set(n.category, (freq.get(n.category) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([cat]) => cat);
}

function pickConcepts(nodes: GraphNode[], categories: Category[], total: number): GraphNode[] {
  const perCat = Math.max(1, Math.floor(total / categories.length));
  const remainder = total - perCat * categories.length;
  const selected: GraphNode[] = [];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const pool = shuffle(nodes.filter((n) => n.category === cat));
    const take = i < remainder ? perCat + 1 : perCat;
    selected.push(...pool.slice(0, take));
  }

  return shuffle(selected).slice(0, total);
}

function measureCardWidth(text: string): number {
  const prepared = prepareWithSegments(text, '15px system-ui');
  const natural = measureNaturalWidth(prepared);
  // Add padding (16px each side) + border-left (4px)
  return Math.ceil(natural) + 36;
}

const FALL_DURATION_MS = 6000;
const CARD_TOTAL = 12;
const CATEGORY_COUNT = 5;

/* ── Component ── */

export default function ConceptCascade({ nodes }: ConceptCascadeProps) {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [results, setResults] = useState<CardResult[]>([]);
  const [queue, setQueue] = useState<GraphNode[]>([]);
  const [current, setCurrent] = useState<GraphNode | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cardState, setCardState] = useState<'falling' | 'dragging' | 'correct' | 'wrong' | 'missed'>('falling');
  const [activeZone, setActiveZone] = useState<Category | null>(null);
  const [pulseRings, setPulseRings] = useState<PulseRing[]>([]);
  const [cardWidth, setCardWidth] = useState(180);

  const playAreaRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef<Map<Category, HTMLDivElement>>(new Map());
  const dragOffset = useRef({ x: 0, y: 0 });
  const cardPos = useRef({ x: 0, y: 0 });
  const fallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedRef = useRef(false);
  const pulseIdRef = useRef(0);

  /* ── Game Setup ── */

  const startGame = useCallback(() => {
    const cats = pickCategories(nodes, CATEGORY_COUNT);
    const concepts = pickConcepts(nodes, cats, CARD_TOTAL);
    setCategories(cats);
    setQueue(concepts.slice(1));
    setResults([]);
    setScore(0);
    setCombo(0);
    setCurrent(concepts[0]);
    setCardState('falling');
    resolvedRef.current = false;
    setPhase('playing');

    const w = measureCardWidth(concepts[0].name);
    setCardWidth(w);
  }, [nodes]);

  /* ── Advance to next concept ── */

  const advance = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrent(null);
        setPhase('results');
        return prev;
      }
      const next = prev[0];
      const rest = prev.slice(1);
      setCurrent(next);
      setCardState('falling');
      resolvedRef.current = false;
      const w = measureCardWidth(next.name);
      setCardWidth(w);
      return rest;
    });
  }, []);

  /* ── Card resolved (correct / wrong / missed) ── */

  const resolveCard = useCallback(
    (outcome: 'correct' | 'wrong' | 'missed', droppedCategory?: Category) => {
      if (resolvedRef.current) return;

      if (outcome === 'correct') {
        resolvedRef.current = true;
        setScore((s) => s + 10);
        setCombo((c) => c + 1);
        setCardState('correct');
        setResults((r) => [...r, { node: current!, outcome, droppedCategory }]);

        // Show pulse ring at drop zone center
        if (droppedCategory) {
          const zoneEl = zoneRefs.current.get(droppedCategory);
          const areaEl = playAreaRef.current;
          if (zoneEl && areaEl) {
            const zoneRect = zoneEl.getBoundingClientRect();
            const areaRect = areaEl.getBoundingClientRect();
            const pid = ++pulseIdRef.current;
            setPulseRings((prev) => [
              ...prev,
              {
                id: pid,
                x: zoneRect.left - areaRect.left + zoneRect.width / 2,
                y: zoneRect.top - areaRect.top + zoneRect.height / 2,
              },
            ]);
            setTimeout(() => {
              setPulseRings((prev) => prev.filter((r) => r.id !== pid));
            }, 700);
          }
        }

        if (fallTimer.current) {
          clearTimeout(fallTimer.current);
          fallTimer.current = null;
        }
        setTimeout(advance, 450);
      } else if (outcome === 'wrong') {
        setScore((s) => Math.max(0, s - 5));
        setCombo(0);
        setCardState('wrong');
        setResults((r) => [...r, { node: current!, outcome, droppedCategory }]);
        // After shake, resume falling
        setTimeout(() => {
          if (!resolvedRef.current) {
            setCardState('falling');
          }
        }, 500);
      } else {
        // missed
        resolvedRef.current = true;
        setCombo(0);
        setCardState('missed');
        setResults((r) => [...r, { node: current!, outcome }]);
        if (fallTimer.current) {
          clearTimeout(fallTimer.current);
          fallTimer.current = null;
        }
        setTimeout(advance, 650);
      }
    },
    [current, advance],
  );

  /* ── Fall Timer ── */

  useEffect(() => {
    if (phase !== 'playing' || !current || cardState !== 'falling') return;

    fallTimer.current = setTimeout(() => {
      resolveCard('missed');
    }, FALL_DURATION_MS);

    return () => {
      if (fallTimer.current) {
        clearTimeout(fallTimer.current);
        fallTimer.current = null;
      }
    };
  }, [phase, current, cardState, resolveCard]);

  /* ── Drop Zone Detection ── */

  const detectZone = useCallback(
    (clientX: number, clientY: number): Category | null => {
      for (const [cat, el] of zoneRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return cat;
        }
      }
      return null;
    },
    [],
  );

  /* ── Pointer Events ── */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (cardState === 'correct' || cardState === 'missed') return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const cardEl = cardRef.current;
      if (!cardEl) return;

      const rect = cardEl.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      cardPos.current = { x: rect.left, y: rect.top };
      setCardState('dragging');
    },
    [cardState],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (cardState !== 'dragging') return;
      e.preventDefault();

      const cardEl = cardRef.current;
      const areaEl = playAreaRef.current;
      if (!cardEl || !areaEl) return;

      const areaRect = areaEl.getBoundingClientRect();
      const newLeft = e.clientX - areaRect.left - dragOffset.current.x;
      const newTop = e.clientY - areaRect.top - dragOffset.current.y;

      cardEl.style.left = `${newLeft}px`;
      cardEl.style.top = `${newTop}px`;
      cardPos.current = { x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y };

      const zone = detectZone(e.clientX, e.clientY);
      setActiveZone(zone);
    },
    [cardState, detectZone],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (cardState !== 'dragging') return;
      e.preventDefault();

      const zone = detectZone(e.clientX, e.clientY);
      setActiveZone(null);

      if (zone) {
        if (current && zone === current.category) {
          resolveCard('correct', zone);
        } else {
          resolveCard('wrong', zone);
        }
      } else {
        // Dropped outside zones, resume falling
        setCardState('falling');
      }
    },
    [cardState, current, detectZone, resolveCard],
  );

  /* ── Ref callback for zone elements ── */

  const setZoneRef = useCallback((cat: Category) => {
    return (el: HTMLDivElement | null) => {
      if (el) {
        zoneRefs.current.set(cat, el);
      } else {
        zoneRefs.current.delete(cat);
      }
    };
  }, []);

  /* ── Compute results breakdown ── */

  const computeBreakdown = useCallback(() => {
    const breakdown: { category: Category; correct: number; total: number }[] = [];
    for (const cat of categories) {
      const items = results.filter((r) => r.node.category === cat);
      const correct = items.filter((r) => r.outcome === 'correct').length;
      breakdown.push({ category: cat, correct, total: items.length });
    }
    return breakdown;
  }, [categories, results]);

  /* ── Card horizontal centering ── */

  const cardLeftPx = current && playAreaRef.current
    ? Math.max(0, (playAreaRef.current.clientWidth - cardWidth) / 2)
    : 0;

  /* ── Render ── */

  if (phase === 'idle') {
    return (
      <div className="cascade-container">
        <div className="cascade-play-area">
          <div className="cascade-start-screen">
            <h2 className="cascade-start-title">Concept Cascade</h2>
            <p className="cascade-start-subtitle">
              Falling concepts appear one at a time. Drag each concept into the correct category zone before it reaches
              the bottom!
            </p>
            <button className="cascade-start-btn" onClick={startGame}>
              Start Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'results') {
    const breakdown = computeBreakdown();
    const totalCorrect = results.filter((r) => r.outcome === 'correct').length;
    const totalWrong = results.filter((r) => r.outcome === 'wrong').length;
    const totalMissed = results.filter((r) => r.outcome === 'missed').length;

    return (
      <div className="cascade-container">
        <div className="cascade-play-area">
          <div className="cascade-results">
            <div className="cascade-results-card">
              <h2 className="cascade-results-title">Results</h2>
              <div className="cascade-results-score">{score}</div>
              <div className="cascade-results-stats">
                <span>
                  <strong>{totalCorrect}</strong>Correct
                </span>
                <span>
                  <strong>{totalWrong}</strong>Wrong
                </span>
                <span>
                  <strong>{totalMissed}</strong>Missed
                </span>
              </div>
              <div className="cascade-results-breakdown">
                {breakdown.map((b) => {
                  const color = CATEGORY_COLORS[b.category];
                  const pct = b.total > 0 ? (b.correct / b.total) * 100 : 0;
                  return (
                    <div key={b.category} className="cascade-results-row">
                      <span className="cascade-results-dot" style={{ background: color }} />
                      <span className="cascade-results-cat-name">
                        {CATEGORY_LABELS[b.category]}
                      </span>
                      <span className="cascade-results-cat-score">
                        {b.correct}/{b.total}
                      </span>
                      <span className="cascade-results-bar-track">
                        <span
                          className="cascade-results-bar-fill"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <button className="cascade-play-again-btn" onClick={startGame}>
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Playing Phase ── */

  const completed = results.length;
  const total = completed + (current ? 1 : 0) + queue.length;

  // Compute zone correct counts for display
  const zoneCounts = new Map<Category, number>();
  for (const r of results) {
    if (r.outcome === 'correct') {
      const cat = r.node.category;
      zoneCounts.set(cat, (zoneCounts.get(cat) ?? 0) + 1);
    }
  }

  return (
    <div className="cascade-container">
      <div
        className="cascade-play-area"
        ref={playAreaRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Score Bar */}
        <div className="cascade-score-bar">
          <span>
            Score: <span className="cascade-score-value">{score}</span>
          </span>
          <span>
            Correct: <span className="cascade-score-value">
              {results.filter((r) => r.outcome === 'correct').length}
            </span>
            /{total}
          </span>
          {combo >= 2 && (
            <span className="cascade-combo">
              Combo x{combo}
            </span>
          )}
        </div>

        {/* Falling Card */}
        {current && (
          <div
            ref={cardRef}
            className={`cascade-card ${
              cardState === 'falling'
                ? 'is-falling'
                : cardState === 'dragging'
                  ? 'is-dragging'
                  : cardState === 'correct'
                    ? 'is-correct'
                    : cardState === 'wrong'
                      ? 'is-wrong'
                      : cardState === 'missed'
                        ? 'is-missed'
                        : ''
            }`}
            style={
              {
                '--card-color': CATEGORY_COLORS[current.category],
                left: cardState === 'dragging' ? undefined : `${cardLeftPx}px`,
                width: `${cardWidth}px`,
              } as React.CSSProperties
            }
            onPointerDown={handlePointerDown}
          >
            <div className="cascade-card-name">{current.name}</div>
            {current.description && <div className="cascade-card-desc">{current.description}</div>}
          </div>
        )}

        {!current && phase === 'playing' && <div className="cascade-waiting">Preparing next concept...</div>}

        {/* Pulse Rings */}
        {pulseRings.map((ring) => (
          <div
            key={ring.id}
            className="cascade-pulse-ring"
            style={{ left: ring.x, top: ring.y }}
          />
        ))}

        {/* Drop Zones */}
        <div className="cascade-zones">
          {categories.map((cat) => {
            const color = CATEGORY_COLORS[cat];
            const isActive = activeZone === cat;
            const correctCount = zoneCounts.get(cat) ?? 0;
            return (
              <div
                key={cat}
                ref={setZoneRef(cat)}
                className={`cascade-zone${isActive ? ' is-active' : ''}`}
                style={
                  {
                    '--zone-color': color,
                    '--zone-bg': `${color}33`,
                    '--zone-bg-active': `${color}55`,
                    '--zone-glow': `${color}44`,
                  } as React.CSSProperties
                }
              >
                <span className="cascade-zone-label">{CATEGORY_LABELS[cat]}</span>
                {correctCount > 0 && <span className="cascade-zone-count">{correctCount} caught</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cascade-progress">
        {completed + 1} / {total}
      </div>
    </div>
  );
}
