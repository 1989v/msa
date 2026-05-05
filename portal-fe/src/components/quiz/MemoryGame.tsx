import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext';
import type { GraphNode } from '../../types/graph';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../types';
import './MemoryGame.css';

interface MemoryGameProps {
  nodes: GraphNode[];
}

type CardKind = 'name' | 'description';

interface Card {
  id: number;
  conceptId: string;
  kind: CardKind;
  text: string;
  category: GraphNode['category'];
}

interface CardState {
  flipped: boolean;
  matched: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function truncateDescription(desc: string, maxLen: number = 60): string {
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen).trimEnd() + '...';
}

function pickRandomConcepts(nodes: GraphNode[], count: number): GraphNode[] {
  const shuffled = shuffleArray(nodes);
  return shuffled.slice(0, count);
}

function buildCards(concepts: GraphNode[]): Card[] {
  const cards: Card[] = [];
  let id = 0;

  for (const concept of concepts) {
    cards.push({
      id: id++,
      conceptId: concept.id,
      kind: 'name',
      text: concept.name,
      category: concept.category,
    });
    cards.push({
      id: id++,
      conceptId: concept.id,
      kind: 'description',
      text: truncateDescription(concept.description ?? ''),
      category: concept.category,
    });
  }

  return shuffleArray(cards);
}

const TOTAL_PAIRS = 6;
const CARD_CONTENT_WIDTH_PX = 110;
const BASE_FONT_SIZE = 14;
const MIN_FONT_SIZE = 9;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

function computeOptimalFontSize(text: string, maxWidth: number): number {
  let fontSize = BASE_FONT_SIZE;

  while (fontSize >= MIN_FONT_SIZE) {
    const font = `${fontSize}px ${FONT_FAMILY}`;
    const prepared = prepareWithSegments(text, font);
    const naturalWidth = measureNaturalWidth(prepared);

    if (naturalWidth <= maxWidth) {
      return fontSize;
    }
    fontSize -= 0.5;
  }

  return MIN_FONT_SIZE;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MemoryGame({ nodes }: MemoryGameProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [matches, setMatches] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [lockBoard, setLockBoard] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fontSizeMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const card of cards) {
      const size = computeOptimalFontSize(card.text, CARD_CONTENT_WIDTH_PX);
      map.set(card.id, size);
    }
    return map;
  }, [cards]);

  const initGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const concepts = pickRandomConcepts(nodes, TOTAL_PAIRS);
    const newCards = buildCards(concepts);
    const initialStates: Record<number, CardState> = {};
    for (const card of newCards) {
      initialStates[card.id] = { flipped: false, matched: false };
    }

    setCards(newCards);
    setCardStates(initialStates);
    setFlippedIds([]);
    setAttempts(0);
    setMatches(0);
    setElapsed(0);
    setGameStarted(false);
    setGameComplete(false);
    setLockBoard(false);
  }, [nodes]);

  useEffect(() => {
    if (nodes.length >= TOTAL_PAIRS) {
      initGame();
    }
  }, [nodes, initGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
  }, [gameStarted]);

  const handleCardClick = useCallback(
    (cardId: number) => {
      if (lockBoard) return;

      const state = cardStates[cardId];
      if (!state || state.flipped || state.matched) return;

      startTimer();

      const newFlipped = [...flippedIds, cardId];

      setCardStates((prev) => ({
        ...prev,
        [cardId]: { ...prev[cardId], flipped: true },
      }));

      if (newFlipped.length === 2) {
        setLockBoard(true);
        setFlippedIds([]);
        setAttempts((prev) => prev + 1);

        const [firstId, secondId] = newFlipped;
        const firstCard = cards.find((c) => c.id === firstId);
        const secondCard = cards.find((c) => c.id === secondId);

        if (
          firstCard &&
          secondCard &&
          firstCard.conceptId === secondCard.conceptId &&
          firstCard.kind !== secondCard.kind
        ) {
          const newMatches = matches + 1;
          setMatches(newMatches);
          setCardStates((prev) => ({
            ...prev,
            [firstId]: { flipped: true, matched: true },
            [secondId]: { flipped: true, matched: true },
          }));
          setLockBoard(false);

          if (newMatches === TOTAL_PAIRS) {
            setGameComplete(true);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        } else {
          setTimeout(() => {
            setCardStates((prev) => ({
              ...prev,
              [firstId]: { ...prev[firstId], flipped: false },
              [secondId]: { ...prev[secondId], flipped: false },
            }));
            setLockBoard(false);
          }, 800);
        }
      } else {
        setFlippedIds(newFlipped);
      }
    },
    [lockBoard, cardStates, flippedIds, cards, matches, startTimer],
  );

  if (nodes.length < TOTAL_PAIRS) {
    return (
      <div className="memory-game">
        <div className="memory-game__insufficient">
          Not enough concepts available. Need at least {TOTAL_PAIRS} concepts
          with descriptions.
        </div>
      </div>
    );
  }

  return (
    <div className="memory-game">
      <div className="memory-game__scorebar">
        <div className="memory-game__stat">
          <span className="memory-game__stat-label">Attempts</span>
          <span className="memory-game__stat-value">{attempts}</span>
        </div>
        <div className="memory-game__stat">
          <span className="memory-game__stat-label">Matches</span>
          <span className="memory-game__stat-value">
            {matches}/{TOTAL_PAIRS}
          </span>
        </div>
        <div className="memory-game__stat">
          <span className="memory-game__stat-label">Time</span>
          <span className="memory-game__stat-value">
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      <div className="memory-game__grid">
        {cards.map((card) => {
          const state = cardStates[card.id];
          if (!state) return null;
          const isFlipped = state.flipped;
          const isMatched = state.matched;
          const categoryColor = CATEGORY_COLORS[card.category];
          const fontSize = fontSizeMap.get(card.id) ?? BASE_FONT_SIZE;

          return (
            <div
              key={card.id}
              className={`memory-card${isFlipped ? ' memory-card--flipped' : ''}${isMatched ? ' memory-card--matched' : ''}`}
              onClick={() => handleCardClick(card.id)}
            >
              <div className="memory-card__inner">
                <div
                  className="memory-card__face memory-card__face--back"
                  style={{ borderLeftColor: categoryColor }}
                >
                  <span
                    className="memory-card__question"
                    style={{ color: categoryColor }}
                  >
                    ?
                  </span>
                </div>
                <div className="memory-card__face memory-card__face--front">
                  {card.kind === 'name' ? (
                    <>
                      <span
                        className="memory-card__badge"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {CATEGORY_LABELS[card.category]}
                      </span>
                      <span
                        className="memory-card__name"
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        {card.text}
                      </span>
                    </>
                  ) : (
                    <span
                      className="memory-card__description"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {card.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {gameComplete && (
        <div className="memory-game__overlay">
          <div className="memory-game__congrats">
            <h2 className="memory-game__congrats-title">All Matched!</h2>
            <div className="memory-game__congrats-stats">
              <p>
                Attempts: <strong>{attempts}</strong>
              </p>
              <p>
                Time: <strong>{formatTime(elapsed)}</strong>
              </p>
              <p>
                Accuracy:{' '}
                <strong>
                  {attempts > 0
                    ? Math.round((TOTAL_PAIRS / attempts) * 100)
                    : 0}
                  %
                </strong>
              </p>
            </div>
            <button className="memory-game__play-again" onClick={initGame}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
